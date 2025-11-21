import mongoose, { Schema } from "mongoose";
import { IGuestUser } from "./guest.interface.js";

const guestUserSchema = new Schema<IGuestUser>(
  {
    fingerprint: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    creditsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastResetDate: {
      type: Date,
      default: Date.now,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    lastRequestTime: {
      type: Date,
      default: Date.now,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockedUntil: {
      type: Date,
      default: undefined,
    },
    isConverted: {
      type: Boolean,
      default: false,
      index: true,
    },
    convertedToEmail: {
      type: String,
      index: true,
    },
    convertedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

guestUserSchema.index({ lastResetDate: 1 });
guestUserSchema.index({ isBlocked: 1, blockedUntil: 1 });
guestUserSchema.index({ fingerprint: 1, isConverted: 1 });
guestUserSchema.index(
  { convertedAt: 1 }, 
  { 
    expireAfterSeconds: 2592000,
    partialFilterExpression: { isConverted: true }
  }
);

export const GuestUser = mongoose.model<IGuestUser>(
  "GuestUser",
  guestUserSchema
);