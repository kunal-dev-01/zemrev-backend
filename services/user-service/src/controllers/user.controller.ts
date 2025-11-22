// src/modules/userService/controllers/user.controller.ts

import { Request, Response } from "express";
import { AppError, catchAsync } from "@zemrev/utils";
import { UserService } from "@/services/user.service.js";

class UserController {
  static getProfile = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?._id;
      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const userProfile = await UserService.getUserById(userId.toString());
      res.status(200).json({
        status: "success",
        data: {
          user: userProfile,
        },
      });
    }
  );

  static getUserById = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { id } = req.params;

      const user = await UserService.getUserById(id);

      res.status(200).json({
        status: "success",
        data: {
          user,
        },
      });
    }
  );

  static updatePassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?._id;
      const { oldPassword, newPassword } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const updatedPassword = await UserService.updatePassword(
        userId.toString(),
        oldPassword,
        newPassword
      );

      if (updatedPassword) {
        res.status(200).json({
          status: "success",
          message: "Password updated successfully",
        });
      }
    }
  );

  static updateAddress = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?._id;
      const { address } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const updatedAddress = await UserService.updateAddress(
        userId.toString(),
        address
      );

      res.status(200).json({
        status: "success",
        data: {
          address: updatedAddress,
        },
      });
    }
  );

  static updateFullName = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userId = req.user?._id;
      const { fullName } = req.body;

      if (!userId) {
        throw new AppError("User not authenticated", 401);
      }

      const updatedFullName = await UserService.updateName(
        userId.toString(),
        fullName
      );

      res.status(200).json({
        status: "success",
        data: {
          fullName: updatedFullName,
        },
      });
    }
  );
}

export default UserController;
