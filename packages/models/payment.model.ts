import mongoose, { Schema, Document } from "mongoose";

export enum PaymentStatus {
  PENDING = "pending",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  REFUNDED = "refunded",
}

export enum PaymentMethod {
  CARD = "card",
  BANK_TRANSFER = "bank_transfer",
  OTHER = "other",
}

export enum PaymentType {
  CREDIT_PURCHASE = "credit_purchase",
}

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  stripePaymentId: string;
  stripeSessionId?: string; // NEW: For checkout session tracking
  amount: number;
  currency: string;
  paymentType: PaymentType; // NEW: Replaces planType
  creditsPurchased: number; // NEW: Track credits bought
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, any>;
  failureReason?: string;
  refundedAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripePaymentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripeSessionId: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
      uppercase: true,
    },
    paymentType: {
      type: String,
      enum: Object.values(PaymentType),
      default: PaymentType.CREDIT_PURCHASE,
      required: true,
      index: true,
    },
    creditsPurchased: {
      type: Number,
      required: true,
      min: 1000,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    failureReason: {
      type: String,
    },
    refundedAt: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ paymentType: 1, paymentStatus: 1 });
paymentSchema.index({ stripeSessionId: 1 }); // NEW: For deduplication

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);