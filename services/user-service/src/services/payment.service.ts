import { Payment, PaymentStatus, PaymentMethod, PaymentType } from "@zemrev/models";

export default class PaymentService {
  // ----------------------------------------------------------
  // Record successful payment (idempotent)
  // ----------------------------------------------------------
  static async record(
    userId: string,
    pid: string,        // stripePaymentId
    sid: string,        // stripeSessionId
    amount: number,
    credits: number
  ): Promise<void> {
    if (await Payment.exists({ stripePaymentId: pid })) {
      console.log(`⚠️ dup payment ${pid}`);
      return;
    }

    await Payment.create({
      userId,
      stripePaymentId: pid,
      stripeSessionId: sid,
      amount,
      currency: "usd",
      paymentType: PaymentType.CREDIT_PURCHASE,
      creditsPurchased: credits,
      paymentStatus: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CARD,
      paidAt: new Date(),
    });

    console.log(`💰 ${userId}  $${amount}  ${credits}c`);
  }

  // ----------------------------------------------------------
  // Idempotency guard
  // ----------------------------------------------------------
  static async findBySession(sessionId: string) {
    return Payment.findOne({ stripeSessionId: sessionId });
  }

  // ----------------------------------------------------------
  // Paginated history
  // ----------------------------------------------------------
  static async history(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      Payment.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ userId }),
    ]);

    return {
      payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // ----------------------------------------------------------
  // Lifetime spend
  // ----------------------------------------------------------
  static async totalSpent(userId: string): Promise<number> {
    const [res] = await Payment.aggregate([
      { $match: { userId, paymentStatus: PaymentStatus.SUCCEEDED } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return res?.total ?? 0;
  }
}