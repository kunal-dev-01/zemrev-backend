import { Document, Model, Schema } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum PlanType {
  BASIC = "basic",
  PRO = "pro",
  ELITE = "elite",
  CUSTOM = "custom",
}

export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
}

export enum SubscriptionStatus {
  INACTIVE = "inactive",
  ACTIVE = "active",
  CANCELED = "canceled",
  PAST_DUE = "past_due",
}

export type PlanPriority = "normal" | "high" | "highest" | "custom";

export interface PlanDetails {
  type: PlanType;
  dailyCredits: number;
  concurrentJobLimit: number;
  priority: PlanPriority;
  price: number;
  features: string[];
  perCreditPrice?: number;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface SignupData {
  fullName: string;
  email: string;
  password: string;
  selectedPlan: PlanType;
}

export interface LoginResponse {
  user: Partial<IUser>;
  accessToken: string;
  refreshToken: string;
  requires2FA?: boolean;
  tempToken?: string;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
}

export interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findOrCreateGoogleUser(profile: GoogleProfile): Promise<IUser>;
}

export interface IUser extends Document, IUserMethods {
  googleId?: string;
  authProvider: AuthProvider;
  fullName: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  address?: Address;
  role: UserRole;
  
  planType: PlanType;
  planActive: boolean;
  plan: PlanDetails;
  credits: number;
  creditsUsed: number;
  nextCreditReset: Date;
  
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  planStartedAt?: Date;
  planExpiresAt?: Date;
  
  isEmailVerified: boolean;
  emailVerificationToken?: string | undefined;
  emailVerificationExpires?: Date | undefined;
  passwordResetToken?: string | undefined;
  passwordResetExpires?: Date | undefined;
  passwordChangedAt?: Date;
  
  twoFactorSecret?: string | undefined;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes?: string[] | undefined;
  superKey?: string;
  
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  registrationFingerprint?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export const planDetailsSchema = new Schema<PlanDetails>(
  {
    type: {
      type: String,
      enum: Object.values(PlanType),
      required: true,
    },
    dailyCredits: {
      type: Number,
      required: true,
      min: 0,
    },
    concurrentJobLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    priority: {
      type: String,
      enum: ["normal", "high", "highest", "custom"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    features: {
      type: [String],
      default: [],
    },
    perCreditPrice: {
      type: Number,
      min: 0,
    },
  },
  { _id: false }
);