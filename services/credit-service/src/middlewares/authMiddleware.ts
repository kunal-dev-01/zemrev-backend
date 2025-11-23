import { Request, Response, NextFunction } from "express";
import { User, GuestUser, UserRole } from "@zemrev/models";
import { JWTService, AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";
import "@zemrev/types";

export default class AuthMiddleware {
  // ----------------------------------------------------------
  // ✅ INTERNAL SERVICE → SERVICE
  // ----------------------------------------------------------
  static service = catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const token = req.headers["x-service-token"] as string;
      const id = req.headers["x-service-id"] as string;
      const secrets: Record<string, string | undefined> = {
        "tool-service": process.env.TOOL_SERVICE_SECRET,
        "analytics-service": process.env.ANALYTICS_SERVICE_SECRET,
      };
      if (!token || !id || !secrets[id] || token !== secrets[id])
        throw new AppError("Invalid service token", 401);
      next();
    }
  );

  // ----------------------------------------------------------
  // ✅ IDENTIFY USER (JWT → Guest → Anon) WITH BLOCKED CHECK
  // ----------------------------------------------------------
  static whoami = catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const token = req.headers.authorization?.split(" ")[1];
      const fp = req.headers["x-fingerprint"] as string;
      const ip =
        (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";

      // ✅ 1. JWT PATH (REGISTERED USER)
      if (token) {
        try {
          const { userId } = JWTService.verifyAccessToken(token);
          const u = await User.findById(userId).lean();
          
          if (u && u.isActive) {
            // ✅ CHECK BLOCKED STATUS
            if (u.isBlocked) {
              throw new AppError(
                `Account blocked: ${u.blockedReason || "Contact support"}`,
                403
              );
            }

            req.userType = "registered";
            req.user = {
              _id: u._id.toString(),
              fullName: u.fullName,
              email: u.email,
              role: u.role,
              credits: u.credits,
              status: u.status,
              isEmailVerified: u.isEmailVerified,
            };
            req.creditInfo = await CreditService.userCredits(u._id.toString());
            return next();
          }
        } catch (err) {
          if (err instanceof AppError) throw err;
          // Invalid token, continue to guest check
        }
      }

      // ✅ 2. GUEST PATH
      if (fp) {
        const info = await CreditService.guestCredits(fp, ip);
        
        // ✅ CHECK BLOCKED STATUS
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

        req.userType = "guest";
        req.guest = {
          _id: fp,
          guestId: fp,
          fingerprint: fp,
          ipAddress: ip,
          dailyCreditsUsed: info.used,
          lastResetAt: info.resetAt,
        };
        req.creditInfo = info;
        return next();
      }

      // ✅ 3. ANONYMOUS
      req.userType = "anonymous";
      req.creditInfo = { total: 0, used: 0, remaining: 0 };
      next();
    }
  );

  // ----------------------------------------------------------
  // ✅ GUARDS
  // ----------------------------------------------------------
  static registered = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered")
      throw new AppError("Registered account required", 401);
    next();
  };

  static admin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || req.user!.role !== UserRole.ADMIN)
      throw new AppError("Admin access required", 403);
    next();
  };
}