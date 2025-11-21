import { Request, Response } from "express";
import CreditService from "../services/credit.service.js";
import { catchAsync, AppError } from "@zemrev/utils";

class CreditController {
  static getStatus = catchAsync(async (req: Request, res: Response): Promise<void> => {
    if (req.userType === "anonymous") {
      throw new AppError("Authentication required", 401);
    }

    let creditInfo;

    if (req.userType === "registered" && req.user) {
      creditInfo = await CreditService.getUserCredits(req.user._id);
    } else if (req.userType === "guest" && req.guest) {
      const fingerprint = req.headers["x-fingerprint"] as string;
      creditInfo = await CreditService.getGuestCredits(fingerprint);
    }

    res.status(200).json({
      status: "success",
      data: {
        userType: req.userType,
        credits: creditInfo,
      },
    });
  });

  static refundCredits = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      throw new AppError("Please provide userId and amount", 400);
    }

    await CreditService.refundCredits(userId, amount);

    res.status(200).json({
      status: "success",
      message: `Refunded ${amount} credits successfully`,
    });
  });
}

export default CreditController;