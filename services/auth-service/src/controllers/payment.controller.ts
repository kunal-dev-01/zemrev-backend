import { Request, Response } from "express";
import Stripe from "stripe";
import StripeService from "../services/stripe.service.js";
import PaymentService from "../services/payment.service.js";
import { catchAsync, AppError } from "@zemrev/utils";
import { CREDIT_PRICING } from "@zemrev/models";
import env from "@/config/env.config.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" as any });

export default class PaymentController {
  // ----------------------------------------------------------
  // Buy credits → return checkout URL
  // ----------------------------------------------------------
  static createCheckout = catchAsync(async (req: Request, res: Response) => {
    const uid = req.user!._id;
    const { credits } = req.body;

    if (!Number.isInteger(credits) || credits < CREDIT_PRICING.MINIMUM_PURCHASE)
      throw new AppError(`Min purchase: ${CREDIT_PRICING.MINIMUM_PURCHASE} credits`, 400);

    const tier = CREDIT_PRICING.TIERS.find((t) => credits >= t.min && credits <= t.max);
    const unit = tier?.pricePerCredit ?? CREDIT_PRICING.PRICE_PER_CREDIT;

    const url = await StripeService.checkout(
      uid,
      credits,
      `${env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      `${env.CLIENT_URL}/payment/cancel`
    );

    res.status(200).json({
      status: "success",
      data: {
        checkoutUrl: url,
        credits,
        pricePerCredit: unit,
        totalPrice: `$${(credits * unit).toFixed(2)}`,
      },
    });
  });

  // ----------------------------------------------------------
  // Confirm payment after redirect
  // ----------------------------------------------------------
  static verifyPayment = catchAsync(async (req: Request, res: Response) => {
    const { session_id } = req.query;
    if (!session_id) throw new AppError("session_id required", 400);

    const cs = await stripe.checkout.sessions.retrieve(session_id as string);
    if (cs.payment_status !== "paid") throw new AppError("Payment not completed", 400);

    res.status(200).json({
      status: "success",
      message: "Payment verified",
      data: {
        credits: Number(cs.metadata?.credits || 0),
        amountTotal: (cs.amount_total ?? 0) / 100,
        paymentStatus: cs.payment_status,
      },
    });
  });

  // ----------------------------------------------------------
  // Stripe webhook
  // ----------------------------------------------------------
  static webhook = catchAsync(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    console.error("❌ Webhook: Missing stripe-signature header");
    throw new AppError("Missing stripe-signature", 400);
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`❌ Webhook signature verification failed: ${err}`);
    throw new AppError(`Webhook Error: ${err}`, 400);
  }

  try {
    await StripeService.webhook(event);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`❌ Webhook processing failed: ${err}`);    
    res.status(200).json({ received: true, error: err });
  }
  });

  // ----------------------------------------------------------
  // Customer portal
  // ----------------------------------------------------------
  static billingPortal = catchAsync(async (req: Request, res: Response) => {
    const url = await StripeService.portal(req.user!._id);
    res.status(200).json({ status: "success", data: { url } });
  });

  // ----------------------------------------------------------
  // History & spend
  // ----------------------------------------------------------
  static history = catchAsync(async (req: Request, res: Response) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const data = await PaymentService.history(req.user!._id, page, limit);
    res.status(200).json({ status: "success", data });
  });

  static totalSpent = catchAsync(async (req: Request, res: Response) => {
    const spent = await PaymentService.totalSpent(req.user!._id);
    res.status(200).json({ status: "success", data: { totalSpent: `$${spent.toFixed(2)}` } });
  });
}