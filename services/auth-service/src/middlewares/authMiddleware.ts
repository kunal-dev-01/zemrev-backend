import { Request, Response, NextFunction } from "express";
import { User, UserRole } from "@zemrev/models";
import { AppError, catchAsync, JWTService } from "@zemrev/utils";
import "@zemrev/types";

class AuthMiddleware {
  /**
   * ---------------------------------------------------------
   * Identify user from JWT if present
   * ---------------------------------------------------------
   */
  static identifyUser = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      req.userType = "anonymous";
      return next();
    }

    try {
      const decoded = JWTService.verifyAccessToken(token);
      const user = await User.findById(decoded.userId);

      if (user && user.isActive && !user.isBlocked) {
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

        req.userType = "registered";
        return next();
      }
    } catch {
      req.userType = "anonymous";
      return next();
    }

    req.userType = "anonymous";
    next();
  });

  /**
   * ---------------------------------------------------------
   * Requires user to be logged in
   * ---------------------------------------------------------
   */
  static requireRegisteredUser = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || !req.user) {
      throw new AppError("Authentication required", 401);
    }
    next();
  };

  /**
   * ---------------------------------------------------------
   * Admin-only routes
   * ---------------------------------------------------------
   */
  static requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || req.userType !== "registered") {
      throw new AppError("Admin access required", 403);
    }

    if (req.user.role !== UserRole.ADMIN) {
      throw new AppError("Admin access required", 403);
    }

    next();
  };
}

export default AuthMiddleware;
