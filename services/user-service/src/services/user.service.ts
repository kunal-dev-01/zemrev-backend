import { User } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";

class UserService {
  static async getProfile(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    return {
      _id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      address: user.address,
      role: user.role,
      planType: user.planType,
      planActive: user.planActive,
      plan: user.plan,
      credits: user.credits,
      creditsUsed: user.creditsUsed,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      isBlocked: user.isBlocked,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async updateProfile(userId: string, data: any): Promise<any> {
    const user = await User.findByIdAndUpdate(
      userId,
      {
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address,
      },
      { new: true, runValidators: true }
    );

    if (!user) throw new AppError("User not found", 404);

    return this.getProfile(userId);
  }

  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      throw new AppError("Current password is incorrect", 401);
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date(Date.now() - 1000);
    await user.save({ validateModifiedOnly: true });

    await redisService.logoutAllDevices(userId);

    console.log(`🔐 Password changed for user: ${user.email}`);
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await User.findById(userId).select("+password");
    if (!user) throw new AppError("User not found", 404);

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid password", 401);
    }

    await User.findByIdAndDelete(userId);
    await redisService.logoutAllDevices(userId);

    console.log(`🗑️ Account deleted: ${user.email}`);
  }
}

export default UserService;