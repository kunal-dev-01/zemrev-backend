import { Request, Response, NextFunction } from "express";
import { GuestUser } from "@zemrev/models";
import { AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";

class CreditMiddleware {
  static checkCredits = (creditsNeeded = 1) =>
    catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
      const fingerprint = req.headers["x-fingerprint"] as string;

      if (req.userType === "guest") {
        await CreditService.deductGuestCredits(fingerprint, creditsNeeded);

        const guest = await GuestUser.findOne({ fingerprint });
        if (guest) {
          req.creditInfo.used = guest.creditsUsed;
          req.creditInfo.remaining = Math.max(0, 15 - guest.creditsUsed);
        }

        return next();
      }

      if (req.userType === "registered" && req.user) {
        await CreditService.deductUserCredits(req.user._id, creditsNeeded, fingerprint);

        const creditInfo = await CreditService.getUserCredits(req.user._id);
        req.creditInfo = {
          total: creditInfo.total as number,
          used: creditInfo.used as number,
          remaining: creditInfo.remaining as number,
          resetDate: creditInfo.resetDate as Date,
        };

        return next();
      }

      throw new AppError("Authentication required to use credits", 401);
    });

  static attachCreditInfo = (req: Request, res: Response, next: NextFunction) => {
    const json = res.json.bind(res);

    res.json = (data) => {
      if (data && typeof data === "object") {
        data.credits ??= req.creditInfo;
      }
      return json(data);
    };

    next();
  };
}

export default CreditMiddleware;