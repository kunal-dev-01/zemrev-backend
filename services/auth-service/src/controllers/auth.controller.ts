import { Request, Response } from "express";
import AuthService from "../services/auth.service.js";
import { PlanType } from "@zemrev/models";
import googleService from "../services/googleAuth.service.js";
import { catchAsync, AppError } from "@zemrev/utils";
import env from "@/config/env.config.js";


class AuthController {
  private static readonly REFRESH_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  private static setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie("refreshToken", refreshToken, this.REFRESH_TOKEN_COOKIE_OPTIONS);
  }

  static signup = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { fullName, email, password, selectedPlan } = req.body;

    if (!fullName || !email || !password) {
      throw new AppError("Please provide all required fields", 400);
    }

    const fingerprint = req.headers["x-fingerprint"] as string;

    const result = await AuthService.signup({
      fullName,
      email,
      password,
      fingerprint,
      selectedPlan: selectedPlan as PlanType,
    });

    AuthController.setRefreshTokenCookie(res, result.refreshToken);

    res.status(201).json({
      status: "success",
      message: result.requiresPayment
        ? "Account created. Complete payment to activate your plan."
        : "Account created successfully. Please verify your email.",
      data: {
        user: result.user,
        accessToken: result.accessToken,
        requiresPayment: result.requiresPayment || false,
      },
    });
  });

  static googleAuth = catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const authUrl = googleService.getGoogleAuthURL();
    res.redirect(authUrl);
  });

  static googleCallback = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query as { code: string };

    if (!code) {
      throw new AppError("Authorization code is missing", 400);
    }

    const result = await googleService.handleGoogleCallback(code);

    AuthController.setRefreshTokenCookie(res, result.refreshToken);

    const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${result.accessToken}`;
    res.redirect(redirectUrl);
  });

  static login = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError("Please provide email and password", 400);
    }

    const deviceInfo = req.headers["user-agent"] || "unknown";
    const result = await AuthService.login(email, password, deviceInfo);

    if (result.requires2FA) {
      res.status(200).json({
        status: "success",
        message: "2FA verification required",
        data: { requires2FA: true, tempToken: result.tempToken },
      });
      return;
    }

    AuthController.setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  });

  static verify2FA = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { tempToken, totpCode, superKey, isBackupCode } = req.body;

    if (!tempToken || !totpCode) {
      throw new AppError("Please provide temp token and code", 400);
    }

    const result = await AuthService.verify2FA(
      tempToken,
      totpCode,
      isBackupCode || false,
      superKey
    );

    AuthController.setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  });

  static verifyEmail = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { token } = req.params;

    const isVerified = await AuthService.verifyEmail(token);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      data: { isEmailVerified: isVerified },
    });
  });

  static resendVerificationEmail = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body;

      await AuthService.resendVerificationEmail(email);

      res.status(200).json({
        status: "success",
        message: "Verification email sent successfully",
      });
    }
  );

  static refreshToken = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new AppError("Refresh token is required", 401);
    }

    const newAccessToken = await AuthService.refreshAccessToken(refreshToken);

    res.status(200).json({
      status: "success",
      data: { accessToken: newAccessToken },
    });
  });

  static logout = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const refreshToken = req.cookies.refreshToken;

    if (!userId || !refreshToken) {
      throw new AppError("Invalid request", 400);
    }

    await AuthService.logout(userId.toString(), refreshToken);

    res.clearCookie("refreshToken");

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  });

  static logoutAll = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Invalid request", 400);
    }

    await AuthService.logoutAll(userId.toString());

    res.clearCookie("refreshToken");

    res.status(200).json({
      status: "success",
      message: "Logged out from all devices",
    });
  });

  static forgotPassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { email } = req.body;

    if (!email) {
      throw new AppError("Please provide email", 400);
    }

    await AuthService.forgotPassword(email);

    res.status(200).json({
      status: "success",
      message: "Password reset link sent to your email",
    });
  });

  static resetPassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { resetPasswordToken, newPassword } = req.body;

    if (!resetPasswordToken || !newPassword) {
      throw new AppError("Please provide reset token and new password", 400);
    }

    await AuthService.resetPassword(resetPasswordToken, newPassword);

    res.status(200).json({
      status: "success",
      message: "Password reset successfully",
    });
  });

  static setup2FA = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Invalid request", 400);
    }

    const result = await AuthService.setup2FA(userId.toString());

    res.status(200).json({
      status: "success",
      message: "Scan QR code with your authenticator app",
      data: {
        qrCode: result.qrCodeUrl,
        secret: result.secret,
        manualEntryKey: result.manualEntryKey,
        backupCodes: result.backupCodes,
      },
    });
  });

  static enable2FA = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { totpCode } = req.body;

    if (!userId || !totpCode) {
      throw new AppError("Invalid request", 400);
    }

    const enabled = await AuthService.enable2FA(userId.toString(), totpCode);

    res.status(200).json({
      status: "success",
      message: "2FA enabled successfully",
      data: { twoFactorEnabled: enabled },
    });
  });

  static disable2FA = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { password, totpCode } = req.body;

    if (!userId || !password) {
      throw new AppError("Please provide password", 400);
    }

    const disabled = await AuthService.disable2FA(userId.toString(), password, totpCode);

    res.status(200).json({
      status: "success",
      message: "2FA disabled successfully",
      data: { twoFactorEnabled: disabled },
    });
  });

  static get2FAStatus = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Invalid request", 400);
    }

    const status = await AuthService.get2FAStatus(userId.toString());

    res.status(200).json({
      status: "success",
      data: status,
    });
  });

  static regenerateBackupCodes = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?._id;
      const { password } = req.body;

      if (!userId || !password) {
        throw new AppError("Please provide password", 400);
      }

      const backupCodes = await AuthService.regenerateBackupCodes(
        userId.toString(),
        password
      );

      res.status(200).json({
        status: "success",
        message: "New backup codes generated",
        data: { backupCodes },
      });
    }
  );
}

export default AuthController;