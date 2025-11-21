import { Document } from "mongoose";

export interface IGuestUser extends Document {
  fingerprint: string;
  ipAddress: string;
  creditsUsed: number;
  lastResetDate: Date;
  requestCount: number;
  lastRequestTime: Date;
  isBlocked: boolean;
  blockedUntil?: Date | undefined;
  
  isConverted: boolean;
  convertedToEmail?: string;
  convertedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}