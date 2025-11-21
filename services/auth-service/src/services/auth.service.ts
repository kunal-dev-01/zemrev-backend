import { User, GuestUser, PlanType, UserRole, SubscriptionStatus, SignupData } from "@zemrev/models";
import { AppError, JWTService } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";
import { getPlanDetails } from "@zemrev/models";
import TwoFactorService from "./twoFactor.service.js";

class AuthService {
  static async signup(data: SignupData & { fingerprint?: string }): Promise<any> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) throw new AppError("Email already registered", 400);

    if (!data.selectedPlan) {
      throw new AppError("Please select a plan", 400);
    }

    if (!Object.values(PlanType).includes(data.selectedPlan)) {
      throw new AppError("Invalid plan selection", 400);
    }

    const planDetails = getPlanDetails(data.selectedPlan);

    const nextReset = new Date();
    nextReset.setUTCHours(0, 0, 0, 0);
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);

    if (data.fingerprint) {
      const guestUser = await GuestUser.findOne({
        fingerprint: data.fingerprint,
        isConverted: true,
      });

      if (guestUser && guestUser.convertedAt) {
        const now = new Date();
        const convertedDate = new Date(guestUser.convertedAt);

        const isSameDay = (
          now.getUTCFullYear() === convertedDate.getUTCFullYear() &&
          now.getUTCMonth() === convertedDate.getUTCMonth() &&
          now.getUTCDate() === convertedDate.getUTCDate()
        );

        if (isSameDay) {
          throw new AppError(
            "This device was already used to create an account today. Please login.",
            403
          );
        }
      }
    }

    const requiresPayment = data.selectedPlan !== PlanType.CUSTOM;

    const user = await User.create({
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      planType: data.selectedPlan,
      planActive: false,
      plan: planDetails,
      credits: 0,
      creditsUsed: 0,
      nextCreditReset: nextReset,
      subscriptionStatus: SubscriptionStatus.INACTIVE,
      role: UserRole.USER,
      registrationFingerprint: data.fingerprint,
    });

    if (data.fingerprint) {
      await GuestUser.findOneAndUpdate(
        { fingerprint: data.fingerprint, isConverted: false },
        {
          isConverted: true,
          convertedToEmail: data.email,
          convertedAt: new Date(),
        }
      );
    }

    const verificationToken = JWTService.generateEmailVerificationToken();
    user.emailVerificationToken = JWTService.hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // TODO: Send email via queue
    console.log(`📧 Email verification link (development): ${verificationToken}`);

    const tokens = JWTService.generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        plan: user.plan,
        planType: user.planType,
        planActive: user.planActive,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        credits: user.credits,
        creditsUsed: user.creditsUsed,
        nextCreditReset: user.nextCreditReset,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        twoFactorEnabled: user.twoFactorEnabled,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      requiresPayment,
    };
  }

  static async verifyEmail(verificationToken: string): Promise<boolean> {
    const hashedToken = JWTService.hashToken(verificationToken);
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired token", 400);

    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.isEmailVerified = true;
    await user.save({ validateModifiedOnly: true });

    return true;
  }

  static async login(email: string, password: string, deviceInfo?: string): Promise<any> {
    const user = await User.findOne({ email, isActive: true }).select("+password +twoFactorSecret +superKey");

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError("Invalid credentials", 401);
    }

    if (user.isBlocked) {
      throw new AppError(`Account blocked: ${user.blockedReason || "Contact support"}`, 403);
    }

    if (user.twoFactorEnabled) {
      const tempToken = JWTService.generateEmailVerificationToken();
      await redisService.store2FAToken(user._id.toString(), tempToken);

      return {
        user: { _id: user._id.toString(), email: user.email },
        requires2FA: true,
        tempToken,
        accessToken: "",
        refreshToken: "",
      };
    }

    const tokens = JWTService.generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(user._id.toString(), tokens.refreshToken, deviceInfo);

    return {
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        plan: user.plan,
        planType: user.planType,
        planActive: user.planActive,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        credits: user.credits,
        creditsUsed: user.creditsUsed,
        nextCreditReset: user.nextCreditReset,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        twoFactorEnabled: user.twoFactorEnabled,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  static async verify2FA(
    tempToken: string,
    totpCode: string,
    isBackupCode: boolean = false,
    superKey?: string
  ): Promise<any> {
    const userId = await redisService.getUserIdFromTempToken(tempToken);
    if (!userId) {
      throw new AppError("Session expired. Please login again.", 401);
    }

    const user = await User.findById(userId).select("+twoFactorSecret +superKey");
    if (!user) throw new AppError("Invalid session", 401);

    const isValidTemp = await redisService.verify2FAToken(userId, tempToken);
    if (!isValidTemp) throw new AppError("Session expired", 401);

    if (user.role === UserRole.ADMIN && (!superKey || superKey !== user.superKey)) {
      throw new AppError("Invalid super key", 401);
    }

    const verified = await TwoFactorService.verify2FALogin(userId, totpCode, isBackupCode);
    if (!verified) throw new AppError("Invalid 2FA code", 401);

    await redisService.delete2FAToken(userId);

    const tokens = JWTService.generateTokenPair({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    await redisService.storeRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      user: {
        _id: user._id.toString(),
        fullName: user.fullName,
        email: user.email,
        plan: user.plan,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        authProvider: user.authProvider,
        credits: user.credits,
        creditsUsed: user.creditsUsed,
        isActive: user.isActive,
        isBlocked: user.isBlocked,
        twoFactorEnabled: user.twoFactorEnabled,
        subscriptionStatus: user.subscriptionStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  static async resendVerificationEmail(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found", 404);
    if (user.isEmailVerified) throw new AppError("Email already verified", 400);

    const verificationToken = JWTService.generateEmailVerificationToken();
    user.emailVerificationToken = JWTService.hashToken(verificationToken);
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateModifiedOnly: true });

    console.log(`📧 Email verification link (development): ${verificationToken}`);
  }

  static async refreshAccessToken(refreshToken: string): Promise<string> {
    const decoded = JWTService.verifyRefreshToken(refreshToken);
    const exists = await redisService.verifyRefreshToken(decoded.userId, refreshToken);
    if (!exists) throw new AppError("Invalid refresh token", 401);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) throw new AppError("User not found", 401);

    const iat = Math.floor(Date.now() / 1000);
    if (user.changedPasswordAfter(iat)) {
      throw new AppError("Password changed. Please login again.", 401);
    }

    return JWTService.generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });
  }

  static async logout(userId: string, refreshToken: string): Promise<void> {
    await redisService.deleteRefreshToken(userId, refreshToken);
  }

  static async logoutAll(userId: string): Promise<void> {
    await redisService.logoutAllDevices(userId);
  }

  static async setup2FA(userId: string): Promise<any> {
    return TwoFactorService.setup2FA(userId);
  }

  static async enable2FA(userId: string, totpCode: string): Promise<boolean> {
    return TwoFactorService.enable2FA(userId, totpCode);
  }

  static async disable2FA(userId: string, password: string, totpCode?: string): Promise<boolean> {
    return TwoFactorService.disable2FA(userId, password, totpCode);
  }

  static async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    return TwoFactorService.regenerateBackupCodes(userId, password);
  }

  static async get2FAStatus(userId: string): Promise<any> {
    return TwoFactorService.get2FAStatus(userId);
  }

  static async forgotPassword(email: string): Promise<boolean> {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email not found", 404);

    const resetToken = JWTService.generatePasswordResetToken();
    user.passwordResetToken = JWTService.hashToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateModifiedOnly: true });

    console.log(`🔐 Password reset link (development): ${resetToken}`);
    return true;
  }

  static async resetPassword(resetToken: string, newPassword: string): Promise<boolean> {
    const hashedToken = JWTService.hashToken(resetToken);
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired token", 400);

    user.password = newPassword;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });

    await redisService.logoutAllDevices(user._id.toString());

    return true;
  }
}

export default AuthService;