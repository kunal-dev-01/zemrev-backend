import { PlanType, PlanDetails } from "./user.interface.js";

export const PLANS: Record<PlanType, PlanDetails> = {
  [PlanType.BASIC]: {
    type: PlanType.BASIC,
    dailyCredits: 100,
    concurrentJobLimit: 10,
    priority: "normal",
    price: 4.99,
    features: [
      "Remove background",
      "Compress images",
      "Convert formats",
      "Basic enhancements",
      "100 credits/day",
      "10 concurrent jobs",
      "Email support",
    ],
  },

  [PlanType.PRO]: {
    type: PlanType.PRO,
    dailyCredits: 250,
    concurrentJobLimit: 15,
    priority: "high",
    price: 9.99,
    features: [
      "All Basic features",
      "High priority queue",
      "Advanced filters",
      "Batch processing",
      "250 credits/day",
      "15 concurrent jobs",
      "Priority email support",
    ],
  },

  [PlanType.ELITE]: {
    type: PlanType.ELITE,
    dailyCredits: 600,
    concurrentJobLimit: 25,
    priority: "highest",
    price: 19.99,
    features: [
      "All Pro features",
      "Highest priority queue",
      "AI enhancement",
      "Premium filters",
      "Watermark removal",
      "600 credits/day",
      "25 concurrent jobs",
      "24/7 priority support",
    ],
  },

  [PlanType.CUSTOM]: {
    type: PlanType.CUSTOM,
    dailyCredits: 0,
    concurrentJobLimit: 50,
    priority: "custom",
    price: 0,
    perCreditPrice: 0.005,
    features: [
      "All Elite features",
      "Pay-as-you-go credits",
      "No daily limits",
      "Credits never expire",
      "Minimum 1000 credits",
      "$0.005 per credit",
      "50 concurrent jobs",
      "Priority support",
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
  [PlanType.BASIC]: process.env.STRIPE_BASIC_PRICE_ID!,
  [PlanType.PRO]: process.env.STRIPE_PRO_PRICE_ID!,
  [PlanType.ELITE]: process.env.STRIPE_ELITE_PRICE_ID!,
  [PlanType.CUSTOM]: null,
};