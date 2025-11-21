import { User, Payment, PaymentStatus, PaymentMethod, PlanType } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

class PaymentService {
  static async getPaymentHistory(userId: string, page: number, limit: number): Promise<any> {
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Payment.countDocuments({ userId });

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async recordPayment(
    userId: string,
    stripePaymentId: string,
    amount: number,
    planType: PlanType,
    metadata?: any
  ): Promise<void> {
    await Payment.create({
      userId,
      stripePaymentId,
      amount,
      currency: "usd",
      planType,
      paymentStatus: PaymentStatus.SUCCEEDED,
      paymentMethod: PaymentMethod.CARD,
      paidAt: new Date(),
      metadata,
    });

    console.log(`💰 Payment recorded: ${userId} | ${planType} | ${amount}`);
  }
}

export default PaymentService;