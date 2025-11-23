import mongoose, { Schema } from "mongoose";
import { IGuestUser } from "./guest.interface.js";

const guestUserSchema = new Schema<IGuestUser>(
  {
    guestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      required: true,
      index: true,
    },
    dailyCreditsUsed: {
      type: Number,
      default: 0,
      min: 0,
      max: 10,
    },
    lastResetAt: {
      type: Date,
      required: true,
      default: () => {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        return today;
      },
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
      index: true,
    },
    blockedUntil: {
      type: Date,
    },
    blockedReason: {
      type: String,
    },
    // Conversion tracking (keep for analytics)
    isConverted: {
      type: Boolean,
      default: false,
      index: true,
    },
    convertedToUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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

// Indexes
guestUserSchema.index({ fingerprint: 1, lastResetAt: 1 });
guestUserSchema.index({ isBlocked: 1, blockedUntil: 1 });
guestUserSchema.index({ lastResetAt: 1 }); 

guestUserSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 2592000,
  }
);

export const GuestUser = mongoose.model<IGuestUser>("GuestUser", guestUserSchema);