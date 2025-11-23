import { Request, Response, NextFunction } from "express";
import { GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";
import AbuseDetectionService from "@/services/abuseDetection.service.js";

export default class CreditMiddleware {
  // ----------------------------------------------------------
  // Deduct credits before controller runs
  // ----------------------------------------------------------
  static spend(cost = 1) {
    return catchAsync(
      async (req: Request, _res: Response, next: NextFunction) => {
        const fp = req.headers["x-fingerprint"] as string;
        const ip =
          (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";

        // Guest
        if (req.userType === "guest") {
          await AbuseDetectionService.rateLimit(fp);
          await AbuseDetectionService.logoutLoop(fp, ip);
          await CreditService.deductGuest(fp, ip, cost);
          const g = await GuestUser.findOne({ fingerprint: fp }).lean();
          if (g) {
            req.creditInfo = req.creditInfo ?? {
              total: 0,
              used: 0,
              remaining: 0,
            };
            req.creditInfo.used = g.dailyCreditsUsed;
            req.creditInfo.remaining = Math.max(
              0,
              CREDIT_PRICING.GUEST_DAILY_LIMIT - g.dailyCreditsUsed
            );
          }
          return next();
        }

        // Registered
        if (req.userType === "registered") {
          await AbuseDetectionService.quickSwitch(
          req.user!._id,
          fp
          );
          await CreditService.deductUser(req.user!._id, cost);
          const info = await CreditService.userCredits(req.user!._id);
          req.creditInfo = info;
          return next();
        }

        // Anonymous
        throw new AppError("Authentication required", 401);
      }
    );
  }

  // ----------------------------------------------------------
  // Inject credit snapshot into every JSON response
  // ----------------------------------------------------------
  static inject(req: Request, res: Response, next: NextFunction) {
    const send = res.json.bind(res);
    res.json = (body: any) => {
      if (body && typeof body === "object" && body.data)
        body.credits = req.creditInfo;
      return send(body);
    };
    next();
  }
}
