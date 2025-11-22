import { Request, Response, NextFunction } from "express";
import { User, GuestUser, UserRole} from "@zemrev/models";
import { JWTService, AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";
import "@zemrev/types"

export default class AuthMiddleware {
  // ----------------------------------------------------------
  // Internal service → service
  // ----------------------------------------------------------
  static service = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers["x-service-token"] as string;
    const id = req.headers["x-service-id"] as string;

    const secrets: Record<string, string | undefined> = {
      "tool-service": process.env.TOOL_SERVICE_SECRET,
      "analytics-service": process.env.ANALYTICS_SERVICE_SECRET,
    };

    if (!token || !id || !secrets[id] || token !== secrets[id])
      throw new AppError("Invalid service token", 401);

    next();
  });

  // ----------------------------------------------------------
  // Attach identity: JWT → guest → anon
  // ----------------------------------------------------------
  static whoami = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    const fp = req.headers["x-fingerprint"] as string;
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";

    // 1. JWT path
    if (token) {
      try {
        const { userId } = JWTService.verifyAccessToken(token);
        const u = await User.findById(userId).lean();
        if (u && u.isActive && !u.isBlocked) {
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
      } catch {
        // ignore
      }
    }

    // 2. Guest path
    if (fp) {
      // one-time-convert guard
      const converted = await GuestUser.findOne({ fingerprint: fp, isConverted: true });
      if (converted) {
        const sameDay =
          new Date().toISOString().slice(0, 10) ===
          new Date(converted.convertedAt!).toISOString().slice(0, 10);
        if (sameDay) throw new AppError("Device already registered today. Please log in.", 403);
      }

      const info = await CreditService.guestCredits(fp, ip);
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

    // 3. Anonymous
    req.userType = "anonymous";
    req.creditInfo = { total: 0, used: 0, remaining: 0 };
    next();
  });

  // ----------------------------------------------------------
  // Guards
  // ----------------------------------------------------------
  static registered = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered") throw new AppError("Registered account required", 401);
    next();
  };

  static anyAuth = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType === "anonymous") throw new AppError("Authentication required", 401);
    next();
  };

  static admin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || req.user!.role !== UserRole.ADMIN)
      throw new AppError("Admin access required", 403);
    next();
  };
}