import { Request, Response, NextFunction } from "express";
import { User, GuestUser, UserRole } from "@zemrev/models";
import { JWTService, AppError, catchAsync } from "@zemrev/utils";
import CreditService from "../services/credit.service.js";

class AuthMiddleware {
  static verifyServiceToken = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const serviceToken = req.headers["x-service-token"] as string;
    const serviceId = req.headers["x-service-id"] as string;

    if (!serviceToken || !serviceId) {
      throw new AppError("Service authentication required", 401);
    }

    const validTokens: Record<string, string> = {
      "tool-service": process.env.TOOL_SERVICE_SECRET!,
      "analytics-service": process.env.ANALYTICS_SERVICE_SECRET!,
    };

    const expected = validTokens[serviceId];
    if (!expected || serviceToken !== expected) {
      throw new AppError("Invalid service token", 401);
    }

    next();
  });

  static identifyUser = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    const fingerprint = req.headers["x-fingerprint"] as string;

    if (token) {
      try {
        const decoded = JWTService.verifyAccessToken(token);
        const user = await User.findById(decoded.userId);

        if (user && user.isActive && !user.isBlocked) {
          req.userType = "registered";
          req.user = {
            _id: user._id.toString(),
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            plan: user.plan,
            planType: user.planType,
            planActive: user.planActive,
            creditsUsed: user.creditsUsed,
            isEmailVerified: user.isEmailVerified,
          };

          const creditInfo = await CreditService.getUserCredits(user._id.toString());
          req.creditInfo = {
            total: creditInfo.total as number,
            used: creditInfo.used as number,
            remaining: creditInfo.remaining as number,
            resetDate: creditInfo.resetDate as Date,
          };

          return next();
        }
      } catch {
        console.log("Invalid token");
      }
    }

    if (fingerprint) {
      const convertedGuest = await GuestUser.findOne({
        fingerprint,
        isConverted: true,
      });

      if (convertedGuest && convertedGuest.convertedAt) {
        const now = new Date();
        const convertedDate = new Date(convertedGuest.convertedAt);

        const isSameDay = (
          now.getUTCFullYear() === convertedDate.getUTCFullYear() &&
          now.getUTCMonth() === convertedDate.getUTCMonth() &&
          now.getUTCDate() === convertedDate.getUTCDate()
        );

        if (isSameDay) {
          throw new AppError(
            "This device has already been registered today. Please login to your account.",
            403
          );
        }
      }

      const guest = await GuestUser.findOne({ fingerprint });
      if (!guest) {
        req.userType = "anonymous";
        return next();
      }

      if (guest.isBlocked && guest.blockedUntil) {
        const now = new Date();
        if (now < guest.blockedUntil) {
          const remainingMinutes = Math.ceil(
            (guest.blockedUntil.getTime() - now.getTime()) / 60000
          );
          throw new AppError(
            `Temporarily blocked. Try again in ${remainingMinutes} minutes.`,
            403
          );
        }
        guest.isBlocked = false;
        guest.blockedUntil = undefined;
      }

      req.userType = "guest";
      req.guest = {
        _id: guest._id.toString(),
        fingerprint: guest.fingerprint,
        ipAddress: guest.ipAddress,
        creditsUsed: guest.creditsUsed,
        lastResetDate: guest.lastResetDate,
      };

      req.creditInfo = {
        total: 15,
        used: guest.creditsUsed,
        remaining: Math.max(0, 15 - guest.creditsUsed),
        resetDate: guest.lastResetDate,
      };

      return next();
    }

    req.userType = "anonymous";
    req.creditInfo = { total: 0, used: 0, remaining: 0 };
    next();
  });

  static requireRegisteredUser = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || !req.user) {
      throw new AppError("Registered account required", 401);
    }
    next();
  };

  static requireAnyAuth = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType === "anonymous") {
      throw new AppError("Authentication required", 401);
    }
    next();
  };

  static requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || !req.user) {
      throw new AppError("Admin access required", 403);
    }

    if (req.user.role !== UserRole.ADMIN) {
      throw new AppError("Admin access required", 403);
    }

    next();
  };
}

export default AuthMiddleware;