import { Request, Response } from "express";
import { catchAsync, AppError } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";

export default class CreditController {
  // ----------------------------------------------------------
  // Current balance
  // ----------------------------------------------------------
  static status = catchAsync(async (req: Request, res: Response) => {
    const fp = req.headers["x-fingerprint"] as string;
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";

    const info =
      req.userType === "registered"
        ? await CreditService.userCredits(req.user!._id)
        : req.userType === "guest" && fp
        ? await CreditService.guestCredits(fp, ip)
        : (() => { throw new AppError("Authentication required", 401); })();

    res.status(200).json({ status: "success", data: info });
  });

  // ----------------------------------------------------------
  // Admin refund
  // ----------------------------------------------------------
  static refund = catchAsync(async (req: Request, res: Response) => {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount) throw new AppError("userId & amount required", 400);

    await CreditService.refund(userId, amount, reason);
    res.status(200).json({ status: "success", message: `${amount} credits refunded` });
  });

  // ----------------------------------------------------------
  // Admin stats
  // ----------------------------------------------------------
  static stats = catchAsync(async (req: Request, res: Response) => {
    const data = await CreditService.stats();
    res.status(200).json({ status: "success", data });
  });
}