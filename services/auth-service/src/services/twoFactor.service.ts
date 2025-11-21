import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { User } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import crypto from "crypto";

class TwoFactorService {
  private readonly APP_NAME = "Zemrev";
  private readonly BACKUP_CODES_COUNT = 10;

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.BACKUP_CODES_COUNT; i++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  async setup2FA(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (user.twoFactorEnabled) {
      throw new AppError(
        "2FA is already enabled. Disable it first to reset.",
        400
      );
    }

    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME} (${user.email})`,
      issuer: this.APP_NAME,
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash("sha256").update(code).digest("hex")
    );

    user.twoFactorSecret = secret.base32;
    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save({ validateModifiedOnly: true });

    console.log(`✅ 2FA setup initiated for user: ${user.email}`);

    return {
      secret: secret.base32,
      qrCodeUrl,
      manualEntryKey: secret.base32,
      backupCodes,
    };
  }

  async enable2FA(userId: string, totpCode: string): Promise<boolean> {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user || !user.twoFactorSecret) {
      throw new AppError("2FA setup not found. Please setup 2FA first.", 400);
    }

    if (user.twoFactorEnabled) {
      throw new AppError("2FA is already enabled", 400);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: totpCode,
      window: 2,
    });

    if (!verified) {
      throw new AppError("Invalid 2FA code. Please try again.", 401);
    }

    user.twoFactorEnabled = true;
    await user.save({ validateModifiedOnly: true });

    return user.twoFactorEnabled;
  }

  async disable2FA(
    userId: string,
    password: string,
    totpCode?: string
  ): Promise<boolean> {
    const user = await User.findById(userId).select(
      "+password +twoFactorSecret"
    );
    if (!user) throw new AppError("User not found", 404);

    if (!user.twoFactorEnabled) {
      throw new AppError("2FA is not enabled", 400);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid password", 401);
    }

    if (totpCode) {
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: "base32",
        token: totpCode,
        window: 2,
      });

      if (!verified) {
        throw new AppError("Invalid 2FA code", 401);
      }
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;
    await user.save({ validateModifiedOnly: true });

    return user.twoFactorEnabled;
  }

  async verify2FALogin(
    userId: string,
    totpCode: string,
    isBackupCode: boolean = false
  ): Promise<boolean> {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new AppError("2FA is not enabled for this account", 400);
    }

    if (isBackupCode) {
      return this.verifyBackupCode(user, totpCode);
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: totpCode,
      window: 2,
    });

    if (!verified) {
      throw new AppError("Invalid 2FA code", 401);
    }

    return true;
  }

  private async verifyBackupCode(user: any, code: string): Promise<boolean> {
    const backupCodes = user.twoFactorBackupCodes || [];

    if (backupCodes.length === 0) {
      throw new AppError("No backup codes available", 400);
    }

    const hashedCode = crypto.createHash("sha256").update(code).digest("hex");
    const index = backupCodes.indexOf(hashedCode);

    if (index === -1) {
      throw new AppError("Invalid backup code", 401);
    }

    backupCodes.splice(index, 1);
    user.twoFactorBackupCodes = backupCodes;
    await user.save({ validateModifiedOnly: true });

    return true;
  }

  async regenerateBackupCodes(
    userId: string,
    password: string
  ): Promise<string[]> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    if (!user.twoFactorEnabled) {
      throw new AppError("2FA must be enabled to generate backup codes", 400);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid password", 401);
    }

    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = backupCodes.map((code) =>
      crypto.createHash("sha256").update(code).digest("hex")
    );

    user.twoFactorBackupCodes = hashedBackupCodes;
    await user.save({ validateModifiedOnly: true });

    console.log(`✅ Backup codes regenerated for user: ${user.email}`);

    return backupCodes;
  }

  async is2FAEnabled(userId: string): Promise<boolean> {
    const user = await User.findById(userId);
    return user?.twoFactorEnabled || false;
  }

  async get2FAStatus(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    return {
      enabled: user.twoFactorEnabled,
      backupCodesRemaining: user.twoFactorBackupCodes?.length || 0,
    };
  }
}

export default new TwoFactorService();