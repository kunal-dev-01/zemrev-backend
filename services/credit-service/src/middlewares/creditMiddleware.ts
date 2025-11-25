import { Request, Response, NextFunction } from "express";
import { User, GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError, catchAsync } from "@zemrev/utils";
import CreditService from "@/services/credit.service.js";
import { AbuseDetectionService } from "@zemrev/config";

export default class CreditMiddleware {
  // ==========================================================
  // GLOBAL BLOCKED CHECK
  // ==========================================================
  static checkBlocked = catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const fp = req.headers["x-fingerprint"] as string;

      // Registered user blocked check
      if (req.userType === "registered" && req.user) {
        const u = await User.findById(req.user._id).lean();

        if (u?.isBlocked) {
          throw new AppError(
            `Account blocked: ${u.blockedReason || "Contact support"}`,
            403
          );
        }
      }

      // Guest blocked check
      if (req.userType === "guest" && fp) {
        const g = await GuestUser.findOne({ fingerprint: fp }).lean();

        if (g?.isBlocked) {
          const now = new Date();

          if (!g.blockedUntil || now < g.blockedUntil) {
            throw new AppError(
              `Blocked until ${
                g.blockedUntil?.toISOString() || "indefinitely"
              }`,
              403
            );
          }
        }
      }

      next();
    }
  );

  // ==========================================================
  // SPEND CREDITS (Guest + Registered)
  // ==========================================================
  static spend(cost = 1) {
    return catchAsync(
      async (req: Request, _res: Response, next: NextFunction) => {
        const fp = req.headers["x-fingerprint"] as string;
        const ip =
          (req.headers["x-forwarded-for"] as string) ||
          req.ip ||
          "unknown";

        // ------------------------------------------------------
        // GUEST PATH
        // ------------------------------------------------------
        if (req.userType === "guest") {
          if (!fp) {
            throw new AppError("Fingerprint required", 400);
          }

          const userAgent =
            req.headers["user-agent"]?.toString() || "unknown";

          // Abuse detection before deduction
          await AbuseDetectionService.enhancedGuestCheck(ip, userAgent);
          await AbuseDetectionService.rateLimit(fp);
          await AbuseDetectionService.logoutLoop(fp, ip);

          // Atomic guest credit deduction
          await CreditService.deductGuest(fp, ip, cost);

          // Update credit info
          const g = await GuestUser.findOne({ fingerprint: fp }).lean();

          if (g) {
            req.creditInfo = {
              total: CREDIT_PRICING.GUEST_DAILY_LIMIT,
              used: g.dailyCreditsUsed,
              remaining: Math.max(
                0,
                CREDIT_PRICING.GUEST_DAILY_LIMIT - g.dailyCreditsUsed
              ),
              resetDate: g.lastResetAt,
            };
          }

          return next();
        }

        // ------------------------------------------------------
        // REGISTERED USER PATH
        // ------------------------------------------------------
        if (req.userType === "registered") {
          // Detect quick switch before deducting
          await AbuseDetectionService.quickSwitch(req.user!._id, fp);

          // Atomic registered credit deduction
          await CreditService.deductUser(req.user!._id, cost);

          // Update credit info
          const info = await CreditService.userCredits(req.user!._id);
          req.creditInfo = info;

          return next();
        }

        // ------------------------------------------------------
        // ANONYMOUS USERS NOT ALLOWED
        // ------------------------------------------------------
        throw new AppError("Authentication required", 401);
      }
    );
  }

  // ==========================================================
  // INJECT CREDIT INFO INTO RESPONSE
  // ==========================================================
  static inject(req: Request, res: Response, next: NextFunction) {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      if (body && typeof body === "object" && body.data) {
        body.credits = req.creditInfo;
      }
      return originalJson(body);
    };

    next();
  }
}
