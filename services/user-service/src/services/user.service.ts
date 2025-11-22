import {
  IUser,
  Address,
  User
} from "@zemrev/models";
import {AppError} from "@zemrev/utils";

export class UserService {
  /* ----------------------------------------------------
     Utility: Remove sensitive fields from the User object
  ---------------------------------------------------- */
  static getSafeUser(user: IUser) {
    const userObj = user.toObject();

    delete userObj.id;
    delete userObj._id;
    delete userObj.__v;
    delete userObj.googleId
    delete userObj.password;
    delete userObj.emailVerificationToken;
    delete userObj.emailVerificationExpires;
    delete userObj.passwordResetToken;
    delete userObj.passwordResetExpires;
    delete userObj.twoFactorSecret;
    delete userObj.superKey;

    return userObj;
  }

  /* ----------------------------------------------------
     Get User by ID (Safe User)
  ---------------------------------------------------- */
  static async getUserById(userId: string) {
    const user = await User.findById(userId);

    if (!user) throw new AppError("User not found", 404);

    return this.getSafeUser(user);
  }

  /* ----------------------------------------------------
     Update Password
  ---------------------------------------------------- */
  static async updatePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ) {
    const user = await User.findById(userId).select("+password");

    if (!user) throw new AppError("User not found", 404);

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) throw new AppError("Old password is incorrect", 400);

    user.password = newPassword;
    user.passwordChangedAt = new Date();

    await user.save({ validateModifiedOnly: true });;

    return true;
  }

  /* ----------------------------------------------------
     Update Phone Number
  ---------------------------------------------------- */
  static async updatePhoneNumber(userId: string, phoneNumber: string) {
    const user = await User.findByIdAndUpdate(
      userId,
      { phoneNumber },
      { new: true }
    );

    if (!user) throw new AppError("User not found", 404);

    return user.phoneNumber;
  }

  /* ----------------------------------------------------
     Update Address
  ---------------------------------------------------- */
  static async updateAddress(userId: string, address: Address) {
    const user = await User.findByIdAndUpdate(
      userId,
      { address },
      { new: true, runValidators: true }
    );

    if (!user) throw new AppError("User not found", 404);

    return user.address;
  }

  /* ----------------------------------------------------
     Update Only Full Name
  ---------------------------------------------------- */
  static async updateName(userId: string, fullName: string) {
    if (!fullName || fullName.trim().length < 2) {
      throw new AppError("Name must be at least 2 characters long", 400);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { fullName },
      { new: true, runValidators: true }
    );

    if (!user) throw new AppError("User not found", 404);

    return user.fullName;
  }
}

export default UserService;