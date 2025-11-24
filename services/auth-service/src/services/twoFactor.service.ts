import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import { User } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

class TwoFactorService {
  private readonly APP_NAME = "Zemrev";
  private readonly BACKUP_CODES_COUNT = 4;

  private generateBackupCodes() {
    return Array.from({ length: this.BACKUP_CODES_COUNT }).map(() =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
  }

  /** SETUP 2FA */
  async setup2FA(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (user.twoFactorEnabled) {
      throw new AppError("2FA already enabled", 400);
    }

    if(user.authProvider === "google") {
      throw new AppError("2FA not supported for Google users", 400);
    }

    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME} (${user.email})`,
      issuer: this.APP_NAME,
      length: 32,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    const backupCodes = this.generateBackupCodes();
    const hashed = backupCodes.map((c) =>
      crypto.createHash("sha256").update(c).digest("hex")
    );

    user.twoFactorSecret = secret.base32;
    user.twoFactorBackupCodes = hashed;

    await user.save({ validateModifiedOnly: true });

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /** ENABLE 2FA */
  async enable2FA(userId: string, code: string) {
    const user = await User.findById(userId).select("+twoFactorSecret");
    if (!user?.twoFactorSecret)
      throw new AppError("2FA setup incomplete", 400);

    if(user.authProvider === "google") {
      throw new AppError("2FA not supported for Google users", 400);
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!valid) throw new AppError("Invalid 2FA code", 401);

    user.twoFactorEnabled = true;
    await user.save({ validateModifiedOnly: true });
    return true;
  }

  /** DISABLE 2FA */
  async disable2FA(userId: string, password: string, code: string) {
    const user = await User.findById(userId).select(
      "+password +twoFactorSecret"
    );
    if (!user) throw new AppError("User not found", 404);

    if(user.authProvider === "google") {
      throw new AppError("2FA not supported for Google users", 400);
    }

    if (!(await user.comparePassword(password))) {
      throw new AppError("Invalid password", 401);
    }

    if (code) {
      const valid = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: "base32",
        token: code,
        window: 2,
      });

      if (!valid) throw new AppError("Invalid 2FA code", 401);
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;

    await user.save({ validateModifiedOnly: true });
    return true;
  }

  /** LOGIN VERIFY */
  async verify2FALogin(userId: string, code: string, isBackup: boolean) {
    const user = await User.findById(userId).select(
      "+twoFactorSecret +twoFactorBackupCodes"
    );

    if (!user?.twoFactorEnabled) {
      throw new AppError("2FA not enabled", 400);
    }

    if(user.authProvider === "google") {
      throw new AppError("2FA not supported for Google users", 400);
    }

    if (isBackup) {
      return this.verifyBackupCode(user, code);
    }

    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!valid) throw new AppError("Invalid 2FA code", 401);

    return true;
  }

  /** BACKUP CODES */
  private async verifyBackupCode(user: any, code: string) {
    const hashed = crypto.createHash("sha256").update(code).digest("hex");

    const index = user.twoFactorBackupCodes.indexOf(hashed);
    if (index === -1) throw new AppError("Invalid backup code", 401);

    user.twoFactorBackupCodes.splice(index, 1);
    await user.save({ validateModifiedOnly: true });

    return true;
  }

  async regenerateBackupCodes(userId: string, password: string) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    if (!user.twoFactorEnabled) {
      throw new AppError("2FA must be enabled", 400);
    }

    if (!(await user.comparePassword(password))) {
      throw new AppError("Invalid password", 401);
    }

    const backupCodes = this.generateBackupCodes();
    const hashed = backupCodes.map((c) =>
      crypto.createHash("sha256").update(c).digest("hex")
    );

    user.twoFactorBackupCodes = hashed;
    await user.save({ validateModifiedOnly: true });

    return backupCodes;
  }
}

export default new TwoFactorService();
