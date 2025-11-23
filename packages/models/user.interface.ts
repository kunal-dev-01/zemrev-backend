import { Document, Model } from "mongoose";

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
}

export type UserStatus = "inactive" | "active";

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
  findOrCreateGoogleUser(
    profile: GoogleProfile,
    fingerprint?: string
  ): Promise<IUser>;
}

export interface IUser extends Document, IUserMethods {
  googleId?: string;
  authProvider: AuthProvider;
  fullName: string;
  email: string;
  password?: string;
  address?: Address;
  role: UserRole;
  credits: number;
  status: UserStatus;
  stripeCustomerId?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string | undefined;
  emailVerificationExpires?: Date | undefined;
  passwordResetToken?: string | undefined;
  passwordResetExpires?: Date | undefined;
  passwordChangedAt?: Date;
  twoFactorSecret?: string;
  twoFactorEnabled: boolean;
  twoFactorBackupCodes?: string[];
  superKey?: string;
  isActive: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}