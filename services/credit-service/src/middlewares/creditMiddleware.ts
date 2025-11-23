import { Request, Response, NextFunction } from "express";
import { User, GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";
import AbuseDetectionService from "@/services/abuseDetection.service.js";

export default class CreditMiddleware {
  // ----------------------------------------------------------
  // ✅ GLOBAL BLOCKED CHECK (Before any credit operation)
  // ----------------------------------------------------------
  static checkBlocked = catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const fp = req.headers["x-fingerprint"] as string;

      // ✅ CHECK USER BLOCKED STATUS
      if (req.userType === "registered" && req.user) {
        const u = await User.findById(req.user._id).lean();
        if (u?.isBlocked) {
          throw new AppError(
            `Account blocked: ${u.blockedReason || "Contact support"}`,
            403
          );
        }
      }

      // ✅ CHECK GUEST BLOCKED STATUS
      if (req.userType === "guest" && fp) {
        const g = await GuestUser.findOne({ fingerprint: fp }).lean();
        if (g?.isBlocked) {
          const now = new Date();
          if (!g.blockedUntil || now < g.blockedUntil) {
            throw new AppError(
              `Blocked until ${g.blockedUntil?.toISOString() || "indefinitely"}`,
              403
            );
          }
        }
      }

      next();
    }
  );

  // ----------------------------------------------------------
  // ✅ DEDUCT CREDITS (Atomic + Abuse-Proof)
  // ----------------------------------------------------------
  static spend(cost = 1) {
    return catchAsync(
      async (req: Request, _res: Response, next: NextFunction) => {
        const fp = req.headers["x-fingerprint"] as string;
        const ip =
          (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";

        // ✅ GUEST PATH
        if (req.userType === "guest") {
          if (!fp) throw new AppError("Fingerprint required", 400);

          // ✅ ABUSE CHECKS FIRST (Before deduction)
          await AbuseDetectionService.rateLimit(fp);
          await AbuseDetectionService.logoutLoop(fp, ip);

          // ✅ ATOMIC DEDUCTION
          await CreditService.deductGuest(fp, ip, cost);

          // ✅ UPDATE CREDIT INFO
          const g = await GuestUser.findOne({ fingerprint: fp }).lean();
          if (g) {
            req.creditInfo = {
              total: CREDIT_PRICING.GUEST_DAILY_LIMIT,
              used: g.dailyCreditsUsed,
              remaining: Math.max(
                0,
                CREDIT_PRICING.GUEST_DAILY_LIMIT - g.dailyCreditsUsed
              ),
              resetAt: g.lastResetAt,
            };
          }

          return next();
        }

        // ✅ REGISTERED USER PATH
        if (req.userType === "registered") {
          // ✅ QUICK-SWITCH CHECK (Before deduction)
          await AbuseDetectionService.quickSwitch(req.user!._id, fp);

          // ✅ ATOMIC DEDUCTION
          await CreditService.deductUser(req.user!._id, cost);

          // ✅ UPDATE CREDIT INFO
          const info = await CreditService.userCredits(req.user!._id);
          req.creditInfo = info;

          return next();
        }

        // ✅ ANONYMOUS
        throw new AppError("Authentication required", 401);
      }
    );
  }

  // ----------------------------------------------------------
  // ✅ INJECT CREDIT INFO INTO RESPONSE
  // ----------------------------------------------------------
  static inject(req: Request, res: Response, next: NextFunction) {
    const send = res.json.bind(res);
    res.json = (body: any) => {
      if (body && typeof body === "object" && body.data) {
        body.credits = req.creditInfo;
      }
      return send(body);
    };
    next();
  }
}