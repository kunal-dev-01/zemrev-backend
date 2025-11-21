import mongoose, { Document, Schema } from "mongoose";
import { PlanType } from "./user.interface.js";

export enum BillingCycle {
  MONTHLY = "monthly",
  YEARLY = "yearly",
}

export interface ISubscription extends Document {
  userId: mongoose.Types.ObjectId;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  planType: PlanType;
  status: string;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
      index: true,
    },
    planType: {
      type: String,
      enum: Object.values(PlanType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      index: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      default: BillingCycle.MONTHLY,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
    },
    trialStart: {
      type: Date,
    },
    trialEnd: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });

export const Subscription = mongoose.model<ISubscription>(
  "Subscription",
  subscriptionSchema
);