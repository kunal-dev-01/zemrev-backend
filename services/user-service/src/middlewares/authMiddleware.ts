import { Request, Response, NextFunction } from "express";
import { User, UserRole} from "@zemrev/models";
import { JWTService, AppError, catchAsync } from "@zemrev/utils";
import "@zemrev/types"

export default class AuthMiddleware {

  // ----------------------------------------------------------
  // Attach identity: JWT → guest → anon
  // ----------------------------------------------------------
  static whoami = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
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
          credits: user.credits,
          status: user.status,
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

  // ----------------------------------------------------------
  // Guards
  // ----------------------------------------------------------
  static registered = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered") throw new AppError("Registered account required", 401);
    next();
  };

  static admin = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || req.user!.role !== UserRole.ADMIN)
      throw new AppError("Admin access required", 403);
    next();
  };
}