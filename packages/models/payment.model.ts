import mongoose, { Schema, Document } from "mongoose";
import { PlanType } from "./user.interface.js";

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

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  stripePaymentId: string;
  stripeInvoiceId?: string;
  amount: number;
  currency: string;
  planType: PlanType;
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
    stripeInvoiceId: {
      type: String,
      index: true,
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
    planType: {
      type: String,
      enum: Object.values(PlanType),
      required: true,
      index: true,
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

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ planType: 1, paymentStatus: 1 });

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);