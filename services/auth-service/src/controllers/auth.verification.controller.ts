import { Request, Response } from "express";
import VerificationService from "@/services/auth.verification.service.js";
import twoFactorService from "@/services/twoFactor.service.js";
import { catchAsync, AppError } from "@zemrev/utils";

class AuthVerificationController {
  // ==========================================================
  // VERIFY EMAIL
  // ==========================================================
  static verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { token } = req.params;

    const success = await VerificationService.verifyEmail(token);

    res.status(200).json({
      status: "success",
      message: "Email verified",
      data: { isEmailVerified: success },
    });
  });

  // ==========================================================
  // RESEND VERIFICATION EMAIL
  // ==========================================================
  static resendVerificationEmail = catchAsync(
    async (req: Request, res: Response) => {
      const { email } = req.body;
      if (!email) throw new AppError("Email is required", 400);

      await VerificationService.resendVerificationEmail(email);

      res.status(200).json({
        status: "success",
        message: "Verification email sent",
      });
    }
  );

  // ==========================================================
  // FORGOT PASSWORD
  // ==========================================================
  static forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email) throw new AppError("Email required", 400);

    await VerificationService.forgotPassword(email);

    res.status(200).json({
      status: "success",
      message: "Password reset link sent",
    });
  });

  // ==========================================================
  // RESET PASSWORD
  // ==========================================================
  static resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { resetPasswordToken, newPassword } = req.body;

    if (!resetPasswordToken || !newPassword) {
      throw new AppError("Missing password reset details", 400);
    }

    await VerificationService.resetPassword(resetPasswordToken, newPassword);

    res.status(200).json({
      status: "success",
      message: "Password reset successful",
    });
  });

  // ==========================================================
  // 2FA: SETUP
  // ==========================================================
  static setup2FA = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) throw new AppError("Invalid request", 400);

    const data = await twoFactorService.setup2FA(userId);

    res.status(200).json({
      status: "success",
      message: "Scan QR code with authenticator app",
      data,
    });
  });

  // ==========================================================
  // 2FA: ENABLE
  // ==========================================================
  static enable2FA = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { totpCode } = req.body;

    if (!userId || !totpCode) {
      throw new AppError("Missing data", 400);
    }

    const enabled = await twoFactorService.enable2FA(userId, totpCode);

    res.status(200).json({
      status: "success",
      message: "2FA enabled",
      data: { twoFactorEnabled: enabled },
    });
  });

  // ==========================================================
  // 2FA: DISABLE
  // ==========================================================
  static disable2FA = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { password, totpCode } = req.body;

    if (!userId || !password) {
      throw new AppError("Missing data", 400);
    }

    const disabled = await twoFactorService.disable2FA(
      userId,
      password,
      totpCode
    );

    res.status(200).json({
      status: "success",
      message: "2FA disabled",
      data: { twoFactorEnabled: disabled },
    });
  });

  // ==========================================================
  // 2FA: REGENERATE BACKUP CODES
  // ==========================================================
  static regenerateBackupCodes = catchAsync(
    async (req: Request, res: Response) => {
      const userId = req.user?._id;
      const { password } = req.body;

      if (!userId || !password) {
        throw new AppError("Missing fields", 400);
      }

      const codes = await twoFactorService.regenerateBackupCodes(
        userId,
        password
      );

      res.status(200).json({
        status: "success",
        message: "Backup codes regenerated",
        data: { backupCodes: codes },
      });
    }
  );
}

export default AuthVerificationController;
