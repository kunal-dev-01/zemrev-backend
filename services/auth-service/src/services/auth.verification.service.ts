import { User } from "@zemrev/models";
import { AppError, JWTService } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";

class AuthVerificationService {
  /** VERIFY EMAIL */
  static async verifyEmail(token: string) {
    const hashed = JWTService.hashToken(token);

    const user = await User.findOne({
      emailVerificationToken: hashed,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired token", 400);

    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.isEmailVerified = true;

    await user.save({ validateModifiedOnly: true });
    return true;
  }

  /** RESEND EMAIL */
  static async resendVerificationEmail(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("User not found", 404);
    if (user.isEmailVerified) throw new AppError("Email already verified", 400);

    const token = JWTService.generateEmailVerificationToken();

    user.emailVerificationToken = JWTService.hashToken(token);
    user.emailVerificationExpires = new Date(Date.now() + 86400000);

    await user.save({ validateModifiedOnly: true });
    console.log("Verification code:", token);
  }

  /** FORGOT PASSWORD */
  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email not found", 404);

    const token = JWTService.generatePasswordResetToken();

    user.passwordResetToken = JWTService.hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 3600000);

    await user.save({ validateModifiedOnly: true });
    console.log("Password reset code:", token);

    return true;
  }

  /** RESET PASSWORD */
  static async resetPassword(token: string, newPassword: string) {
    const hashed = JWTService.hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashed,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) throw new AppError("Invalid or expired token", 400);

    user.password = newPassword;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateModifiedOnly: true });

    await redisService.logoutAllDevices(user.id);
    return true;
  }
}

export default AuthVerificationService;
