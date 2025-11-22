import { Document, Model, Schema } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum PlanType {
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
}

export type PlanPriority = "custom";

export interface PlanDetails {
  type: PlanType;
  concurrentJobLimit: number;
  priority: PlanPriority;
  price: number;
  features: string[];
  perCreditPrice: number;
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
  selectedCredits: number;
}

export interface LoginResponse {
  user: Partial<IUser>;
  accessToken: string;
  refreshToken: string;
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

  
  credits: number; // Total credits bought
  creditsUsed: number; // Credits used till now

  stripeCustomerId?: string;
  subscriptionStatus: SubscriptionStatus;
  planStartedAt?: Date;

  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  passwordChangedAt?: Date;

  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes?: string[];
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
    concurrentJobLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    priority: {
      type: String,
      enum: ["custom"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    features: {
      type: [String],
      default: [],
    },
    perCreditPrice: {
      type: Number,
      required: true,
      default: 0.002,
    },
  },
  { _id: false }
);