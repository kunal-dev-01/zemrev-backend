import { PlanType, PlanDetails } from "./user.interface.js";

export const PLANS: Record<PlanType, PlanDetails> = {
  [PlanType.CUSTOM]: {
    type: PlanType.CUSTOM,
    concurrentJobLimit: 50,
    priority: "custom",
    price: 0,
    perCreditPrice: 0.002,
    features: [
      "Pay-as-you-go credits",
      "No daily limits",
      "Credits never expire",
      "Minimum 1000 credits purchase",
      "$0.002 per credit",
      "50 concurrent jobs",
      "Priority support",
      "All features unlocked",
    ],
  },
};

export const getPlanDetails = (planType: PlanType): PlanDetails => {
  const plan = PLANS[planType];
  if (!plan) {
    throw new Error(`Invalid plan type: ${planType}`);
  }
  return plan;
};

export const STRIPE_PRICE_IDS: Record<PlanType, string | null> = {
  [PlanType.CUSTOM]: null,
};