import {
  User,
  GuestUser,
  UserRole,
  SignupData
} from "@zemrev/models";
import env from "@/config/env.config.js";
import { AppError, JWTService, EmailProducer } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";
import TwoFactorService from "./twoFactor.service.js";
import AbuseDetectionService from "./abuseDetection.service.js";

class AuthService {
  /**-------------------------------
   * ✅ USER SIGNUP (With abuse prevention)
   * -------------------------------*/
  static async signup(
    data: SignupData & { fingerprint?: string }
  ): Promise<any> {
    const { email, fingerprint } = data;

    // ✅ VALIDATE EMAIL
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new AppError("Email already registered", 400);

    // ✅ PREVENT MULTI-ACCOUNT ABUSE (One device per day)
    if (fingerprint) {
      await AbuseDetectionService.multiAccount(fingerprint);
    }
 
    // ✅ CREATE USER (status = "inactive", credits = 0)
    const user = await User.create({
      fullName: data.fullName,
      email,
      password: data.password,
      credits: 0,
      status: "inactive",
      role: UserRole.USER,
    });

    // ✅ MARK GUEST AS CONVERTED (if fingerprint exists)
    if (fingerprint) {
      await GuestUser.findOneAndUpdate(
        { fingerprint, isConverted: false },
        {
          isConverted: true,
          convertedAt: new Date(),
          convertedToUserId: user._id,
        }
      );
    }

    // ✅ EMAIL VERIFICATION TOKEN
    const token = JWTService.generateEmailVerificationToken();
    user.emailVerificationToken = JWTService.hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 86400000);
    await user.save();

    const verificationUrl = `${env.CLIENT_URL}/auth/verify-email?token=${token}`;

    await EmailProducer.sendVerificationEmail(
      email,
      user.fullName,
      verificationUrl,
      "Zemrev"
    );

    // ✅ LOGIN TOKENS
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
      requiresPayment: true, // ✅ Always requires payment for new users
    };
  }    

  /**-------------------------------
   * ✅ LOGIN
   * -------------------------------*/
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

    // ✅ 2FA LOGIN FLOW
    if (user.twoFactorEnabled) {
      const tempToken = JWTService.generateEmailVerificationToken();
      await redisService.store2FAToken(user.id, tempToken);

      return {
        user: { _id: user.id, email: user.email },
        requires2FA: true,
        tempToken,
      };
    }

    // ✅ NORMAL LOGIN
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

  /**-------------------------------
   * ✅ VERIFY 2FA LOGIN
   * -------------------------------*/
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

    await redisService.verify2FAToken(userId, tempToken);

    const verified = await TwoFactorService.verify2FALogin(
      userId,
      totpCode,
      isBackup
    );

    if (!verified) throw new AppError("Invalid 2FA code", 401);

    await redisService.delete2FAToken(userId);

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

  /**-------------------------------
   * ✅ REFRESH TOKEN
   * -------------------------------*/
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

  /**-------------------------------
   * ✅ LOGOUT
   * -------------------------------*/
  static async logout(userId: string, refreshToken: string) {
    await redisService.deleteRefreshToken(userId, refreshToken);
  }

  static async logoutAll(userId: string) {
    await redisService.logoutAllDevices(userId);
  }
}

export default AuthService;