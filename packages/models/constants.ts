export const CREDIT_PRICING = {
  PRICE_PER_CREDIT: 0.002, // $0.002 per credit
  MINIMUM_PURCHASE: 1000, // Minimum 1000 credits
  GUEST_DAILY_LIMIT: 10, // 10 free credits per day for guests
  
  // Pricing tiers (optional bulk discounts)
  TIERS: [
    { min: 1000, max: 4999, pricePerCredit: 0.002 },
    { min: 5000, max: 9999, pricePerCredit: 0.0019 }, // 5% discount
    { min: 10000, max: Infinity, pricePerCredit: 0.0018 }, // 10% discount
  ],
} as const;

export const RATE_LIMITS = {
  GUEST: {
    REQUESTS_PER_MINUTE: 10,
    REQUESTS_PER_HOUR: 50,
    BLOCK_DURATION_MINUTES: 60,
  },
  USER: {
    REQUESTS_PER_MINUTE: 60,
    REQUESTS_PER_HOUR: 500,
  },
} as const;