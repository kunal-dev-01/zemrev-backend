import Stripe from "stripe";
import { User, CREDIT_PRICING } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import PaymentService from "./payment.service.js";
import env from "@/config/env.config.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

export default class StripeService {
  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private static priceInCents(credits: number): number {
    const tier = CREDIT_PRICING.TIERS.find((t) => credits >= t.min && credits <= t.max);
    const unit = tier?.pricePerCredit ?? CREDIT_PRICING.PRICE_PER_CREDIT;
    return Math.round(credits * unit * 100); // ¢
  }

  // ----------------------------------------------------------
  // One-time checkout
  // ----------------------------------------------------------
  static async checkout(
    userId: string,
    credits: number,
    successUrl: string,
    cancelUrl: string
  ): Promise<string> {
    if (credits < CREDIT_PRICING.MINIMUM_PURCHASE)
      throw new AppError(`Min purchase: ${CREDIT_PRICING.MINIMUM_PURCHASE} credits`, 400);

    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    // Ensure Stripe customer
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
              name: `${credits.toLocaleString()} Credits`,
              description: "Top-up your Zemrev balance",
              images: [`${env.CLIENT_URL}/logo.png`],
            },
            unit_amount: this.priceInCents(credits),
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user._id.toString(), credits: credits.toString(), type: "credit" },
      client_reference_id: `${userId}-${Date.now()}`, // idempotency
    });

    console.log(`💳 session=${session.id} credits=${credits}`);
    return session.url!;
  }

  // ----------------------------------------------------------
  // Grant credits (webhook)
  // ----------------------------------------------------------
  private static async grantCredits(userId: string, credits: number, sessionId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    // Idempotency guard
    if (await PaymentService.findBySession(sessionId)) {
      console.log(`⚠️ already processed session=${sessionId}`);
      return;
    }

    user.credits += credits;
    user.status = "active";
    await user.save();

    console.log(`✅ ${user.email} +${credits} total=${user.credits}`);
  }

  // ----------------------------------------------------------
  // Webhook handler
  // ----------------------------------------------------------
  static async webhook(evt: Stripe.Event): Promise<void> {
    console.log(`🔔 ${evt.type}`);

    try {
      switch (evt.type) {
        case "checkout.session.completed": {
          const cs = evt.data.object as Stripe.Checkout.Session;
          if (cs.mode !== "payment") return;

          const uid = cs.metadata?.userId;
          const credits = Number(cs.metadata?.credits || 0);
          if (!uid || !credits || cs.payment_status !== "paid") return;

          await this.grantCredits(uid, credits, cs.id);

          await PaymentService.record(
            uid,
            cs.payment_intent as string,
            cs.id,
            (cs.amount_total ?? 0) / 100,
            credits
          );
          break;
        }

        case "payment_intent.succeeded":
          console.log(`✅ pi=${(evt.data.object as Stripe.PaymentIntent).id}`);
          break;

        case "payment_intent.payment_failed":
          console.log(`❌ pi=${(evt.data.object as Stripe.PaymentIntent).id}`);
          break;

        case "charge.refunded":
          console.log(`🔄 refund=${(evt.data.object as Stripe.Charge).id}`);
          break;

        default:
          console.log(`⚠️ unhandled ${evt.type}`);
      }
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  // ----------------------------------------------------------
  // Customer portal
  // ----------------------------------------------------------
  static async portal(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user?.stripeCustomerId) throw new AppError("No billing account", 404);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.CLIENT_URL}/dashboard`,
    });
    return session.url;
  }
}