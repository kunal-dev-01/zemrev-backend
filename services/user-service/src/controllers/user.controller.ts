import { Request, Response } from "express";
import UserService from "../services/user.service.js";
import { catchAsync, AppError } from "@zemrev/utils";

class UserController {
  static getProfile = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const user = await UserService.getProfile(userId);

    res.status(200).json({
      status: "success",
      data: { user },
    });
  });

  static updateProfile = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { fullName, phoneNumber, address } = req.body;

    if (!userId) {
      throw new AppError("Authentication required", 401);
    }

    const user = await UserService.updateProfile(userId, {
      fullName,
      phoneNumber,
      address,
    });

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: { user },
    });
  });

  static changePassword = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      throw new AppError("Please provide all required fields", 400);
    }

    await UserService.changePassword(userId, currentPassword, newPassword);

    res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  });

  static deletAccount = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?._id;
    const { password } = req.body;

    if (!userId || !password) {
      throw new AppError("Please provide password", 400);
    }

    await UserService.deleteAccount(userId, password);

    res.status(200).json({
      status: "success",
      message: "Account deleted successfully",
    });
  });
}

export default UserController;