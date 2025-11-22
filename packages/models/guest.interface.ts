import { Document, Types } from "mongoose";

export interface IGuestUser extends Document {
  guestId: string;
  fingerprint: string;
  ipAddress: string;
  dailyCreditsUsed: number;
  lastResetAt: Date;
  requestCount: number;
  lastRequestTime: Date;
  isBlocked: boolean;
  blockedUntil?: Date;
  blockedReason?: string;
  isConverted: boolean;
  convertedToUserId?: Types.ObjectId;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}