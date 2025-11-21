import {
  User,
  GuestUser,
  PlanType,
  UserRole,
  SubscriptionStatus,
  SignupData,
  getPlanDetails,
} from "@zemrev/models";

import { AppError, JWTService } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";
import TwoFactorService from "./twoFactor.service.js";

class AuthService {
  /**
   * -------------------------------
   * USER SIGNUP
   * -------------------------------
   */
  static async signup(
    data: SignupData & { fingerprint?: string }
  ): Promise<any> {
    const { email, selectedPlan, fingerprint } = data;

    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("Email already registered", 400);

    if (!selectedPlan) throw new AppError("Please select a plan", 400);
    if (!Object.values(PlanType).includes(selectedPlan)) {
      throw new AppError("Invalid plan selection", 400);
    }

    const planDetails = getPlanDetails(selectedPlan);

    // Next Credit Reset = Tomorrow 00:00 UTC
    const nextReset = new Date();
    nextReset.setUTCHours(0, 0, 0, 0);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);

    /** Prevent multiple accounts from same device per day */
    if (fingerprint) {
      const guestUser = await GuestUser.findOne({
        fingerprint,
        isConverted: true,
      });

      if (guestUser?.convertedAt) {
        const today = new Date();
        const converted = new Date(guestUser.convertedAt);

        const sameDay =
          today.getUTCFullYear() === converted.getUTCFullYear() &&
          today.getUTCMonth() === converted.getUTCMonth() &&
          today.getUTCDate() === converted.getUTCDate();

        if (sameDay)
          throw new AppError(
            "This device already created an account today. Please login.",
            403
          );
      }
    }

    const requiresPayment = selectedPlan !== PlanType.CUSTOM;

    /** CREATE USER */
    const user = await User.create({
      fullName: data.fullName,
      email,
      password: data.password,
      planType: selectedPlan,
      plan: planDetails,
      planActive: false,
      credits: 0,
      creditsUsed: 0,
      nextCreditReset: nextReset,
      subscriptionStatus: SubscriptionStatus.INACTIVE,
      role: UserRole.USER,
      registrationFingerprint: fingerprint,
    });

    /** Update guest record */
    if (fingerprint) {
      await GuestUser.findOneAndUpdate(
        { fingerprint, isConverted: false },
        {
          isConverted: true,
          convertedAt: new Date(),
          convertedToEmail: email,
        }
      );
    }

    /** EMAIL VERIFICATION TOKEN */
    const token = JWTService.generateEmailVerificationToken();
    user.emailVerificationToken = JWTService.hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 86400000);
    await user.save();

    console.log(`Email verification code: ${token}`);

    /** LOGIN TOKENS */
    const tokens = JWTService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      requiresPayment,
    };
  }

  /**
   * -------------------------------
   * LOGIN
   * -------------------------------
   */
  static async login(
    email: string,
    password: string,
    deviceInfo?: string
  ): Promise<any> {
    const user = await User.findOne({ email, isActive: true }).select(
      "+password +twoFactorSecret +superKey"
    );

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid credentials", 401);
    }

    if (user.isBlocked) {
      throw new AppError(`Account blocked: ${user.blockedReason}`, 403);
    }

    /** 2FA LOGIN FLOW */
    if (user.twoFactorEnabled) {
      const tempToken = JWTService.generateEmailVerificationToken();
      await redisService.store2FAToken(user.id, tempToken);

      return {
        user: { _id: user.id, email: user.email },
        requires2FA: true,
        tempToken,
      };
    }

    /** NORMAL LOGIN */
    const tokens = JWTService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(user.id, tokens.refreshToken, deviceInfo);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * -------------------------------
   * VERIFY 2FA LOGIN
   * -------------------------------
   */
  static async verify2FA(
    tempToken: string,
    totpCode: string,
    isBackup: boolean,
    superKey?: string
  ) {
    const userId = await redisService.getUserIdFromTempToken(tempToken);
    if (!userId) throw new AppError("Session expired. Login again.", 401);

    const user = await User.findById(userId).select("+twoFactorSecret +superKey");
    if (!user) throw new AppError("Invalid session", 401);

    if (user.role === UserRole.ADMIN && superKey !== user.superKey) {
      throw new AppError("Invalid super key", 401);
    }

    /** Verify TOTP or Backup Code */
    await redisService.verify2FAToken(userId, tempToken);

    const verified = await TwoFactorService.verify2FALogin(
      userId,
      totpCode,
      isBackup
    );

    if (!verified) throw new AppError("Invalid 2FA code", 401);

    await redisService.delete2FAToken(userId);

    /** NEW TOKEN PAIR */
    const tokens = JWTService.generateTokenPair({
      userId,
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(userId, tokens.refreshToken);

    return {
      user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  /**
   * -------------------------------
   * REFRESH TOKEN
   * -------------------------------
   */
  static async refreshAccessToken(refreshToken: string): Promise<string> {
    const decoded = JWTService.verifyRefreshToken(refreshToken);

    const exists = await redisService.verifyRefreshToken(
      decoded.userId,
      refreshToken
    );

    if (!exists) throw new AppError("Invalid refresh token", 401);

    const user = await User.findById(decoded.userId);
    if (!user?.isActive) throw new AppError("User not found", 401);

    return JWTService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /**
   * -------------------------------
   * LOGOUT
   * -------------------------------
   */
  static async logout(userId: string, refreshToken: string) {
    await redisService.deleteRefreshToken(userId, refreshToken);
  }

  static async logoutAll(userId: string) {
    await redisService.logoutAllDevices(userId);
  }
}

export default AuthService;
