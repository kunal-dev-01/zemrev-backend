import { Request, Response } from "express";
import Stripe from "stripe";
import StripeService from "../services/stripe.service.js";
import { Payment } from "@zemrev/models";
import { PlanType } from "@zemrev/models";
import { catchAsync, AppError } from "@zemrev/utils";
import { User } from "@zemrev/models";
import env from "@/config/env.config.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20" as any,
});

class PaymentController {
  static createCheckout = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { planType } = req.body;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    if (!planType || !Object.values(PlanType).includes(planType)) {
      throw new AppError("Invalid plan type", 400);
    }

    if (planType === PlanType.CUSTOM) {
      throw new AppError("Use /buy-credits for CUSTOM plan", 400);
    }

    const successUrl = `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.CLIENT_URL}/payment/cancel`;

    const checkoutUrl = await StripeService.createCheckoutSession(
      userId,
      planType,
      successUrl,
      cancelUrl
    );

    res.status(200).json({
      status: "success",
      data: { checkoutUrl },
    });
  });

  static buyCredits = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { credits } = req.body;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    if (!credits || typeof credits !== "number" || credits < 1000) {
      throw new AppError("Minimum 1000 credits required", 400);
    }

    const successUrl = `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${env.CLIENT_URL}/payment/cancel`;

    const checkoutUrl = await StripeService.buyCredits(
      userId,
      credits,
      successUrl,
      cancelUrl
    );

    const price = (credits * 0.005).toFixed(2);

    res.status(200).json({
      status: "success",
      data: {
        checkoutUrl,
        credits,
        price: `${price}`,
      },
    });
  });

  static verifyPayment = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { session_id } = req.query;

    if (!session_id) {
      throw new AppError("Session ID required", 400);
    }

    const session = await stripe.checkout.sessions.retrieve(session_id as string);

    if (session.payment_status !== "paid") {
      throw new AppError("Payment not completed", 400);
    }

    res.status(200).json({
      status: "success",
      message: "Payment verified successfully",
      data: {
        planType: session.metadata?.planType,
        amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      },
    });
  });

  static cancelSubscription = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    await StripeService.cancelSubscription(userId);

    res.status(200).json({
      status: "success",
      message: "Subscription canceled successfully",
    });
  });

  static webhook = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

    if (!sig) {
      throw new AppError("Missing stripe signature", 400);
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:");
      throw new AppError(`Webhook Error: ${err}`, 400);
    }

    await StripeService.handleWebhook(event);

    res.status(200).json({ received: true });
  });

  static getBillingPortal = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      throw new AppError("No billing account found", 404);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${env.CLIENT_URL}/dashboard`,
    });

    res.status(200).json({
      status: "success",
      data: { url: session.url },
    });
  });

  static getPaymentHistory = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({ userId });

    res.status(200).json({
      status: "success",
      data: {
        payments,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  });
}

export default PaymentController;