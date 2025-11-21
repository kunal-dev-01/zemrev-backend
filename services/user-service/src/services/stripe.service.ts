import Stripe from "stripe";
import { User, Subscription, SubscriptionStatus, PlanType } from "@zemrev/models";
import { getPlanDetails, STRIPE_PRICE_IDS } from "@zemrev/config";
import { AppError } from "@zemrev/utils";
import PaymentService from "./payment.service.js";
import { getEnv } from "@zemrev/config";

const env = getEnv();
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any,
});

class StripeService {
  static async createCheckoutSession(
    userId: string,
    planType: PlanType,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    if (planType === PlanType.CUSTOM) {
      throw new AppError("Use /buy-credits for CUSTOM plan", 400);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: { userId: user._id.toString() },
      });

      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const priceId = STRIPE_PRICE_IDS[planType];
    if (!priceId) throw new AppError("Plan not configured in Stripe", 400);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user._id.toString(), planType },
    });

    return session.url!;
  }

  static async buyCredits(
    userId: string,
    credits: number,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    if (credits < 1000) {
      throw new AppError("Minimum 1000 credits required", 400);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const priceInCents = Math.round(credits * 0.5);

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: { userId: user._id.toString() },
      });

      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${credits} Credits`,
              description: "Prepaid credits for CUSTOM plan",
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user._id.toString(),
        planType: "CUSTOM_CREDIT_PURCHASE",
        credits: credits.toString(),
      },
    });

    return session.url!;
  }

  static async activatePlan(
    userId: string,
    planType: PlanType,
    subscriptionId: string,
    customerId: string,
    stripeSubscription: Stripe.Subscription
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    const planDetails = getPlanDetails(planType);

    const nextReset = new Date();
    nextReset.setUTCHours(0, 0, 0, 0);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);

    user.planType = planType;
    user.planActive = true;
    user.plan = planDetails;
    user.credits = planDetails.dailyCredits;
    user.creditsUsed = 0;
    user.nextCreditReset = nextReset;
    user.stripeCustomerId = customerId;
    user.subscriptionId = subscriptionId;
    user.subscriptionStatus = SubscriptionStatus.ACTIVE;
    user.planStartedAt = new Date();

    await user.save();

    await Subscription.create({
      userId: user._id,
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      planType,
      status: stripeSubscription.status,
      billingCycle: "monthly",
      currentPeriodStart: new Date((stripeSubscription.current_period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((stripeSubscription.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end ?? false,
    });

    console.log(`✅ Plan activated: ${user.email} → ${planType}`);
  }

  static async addCredits(userId: string, credits: number): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (user.planType !== PlanType.CUSTOM) {
      const customPlan = getPlanDetails(PlanType.CUSTOM);
      user.planType = PlanType.CUSTOM;
      user.plan = customPlan;
    }

    user.credits += credits;
    user.planActive = true;
    user.subscriptionStatus = SubscriptionStatus.ACTIVE;
    user.planStartedAt = user.planStartedAt || new Date();

    await user.save();

    console.log(`💳 Credits added: ${user.email} +${credits} (Total: ${user.credits})`);
  }

  static async deactivatePlan(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    user.planActive = false;
    user.credits = 0;
    user.creditsUsed = 0;
    user.subscriptionStatus = SubscriptionStatus.CANCELED;
    user.planExpiresAt = new Date();

    await user.save();

    if (user.subscriptionId) {
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: user.subscriptionId },
        { status: "canceled", canceledAt: new Date() }
      );
    }

    console.log(`❌ Plan deactivated: ${user.email}`);
  }

  static async cancelSubscription(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user || !user.subscriptionId)
      throw new AppError("No active subscription", 404);

    await stripe.subscriptions.cancel(user.subscriptionId);
    console.log(`🚫 Subscription canceled: ${user.email}`);
  }

  static async handleWebhook(event: Stripe.Event): Promise<void> {
    console.log("🔔 Webhook:", event.type);

    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string | undefined;
        const paymentIntent = invoice.payment_intent!;

        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata?.userId;
        const planType = subscription.metadata?.planType as PlanType;

        if (userId && planType) {
          await this.activatePlan(userId, planType, subscriptionId, customerId, subscription);
          await PaymentService.recordPayment(userId, paymentIntent as string, (invoice.amount_paid ?? 0) / 100, planType);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as any;

        if (session.mode === "payment" && session.metadata?.planType === "CUSTOM_CREDIT_PURCHASE") {
          const userId = session.metadata.userId;
          const credits = parseInt(session.metadata.credits || "0");

          if (userId && credits > 0) {
            await this.addCredits(userId, credits);
            await PaymentService.recordPayment(
              userId,
              session.payment_intent as string,
              (session.amount_total ?? 0) / 100,
              PlanType.CUSTOM,
              { credits }
            );
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          await this.deactivatePlan(userId);
        }
        break;
      }

      default:
        console.log("⚠️ Unhandled:", event.type);
    }
  }
}

export default StripeService;