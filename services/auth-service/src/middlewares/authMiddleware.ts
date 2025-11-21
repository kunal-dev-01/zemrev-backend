import { Request, Response, NextFunction } from "express";
import { User, UserRole } from "@zemrev/models";
import { jwtService, AppError, catchAsync } from "@zemrev/utils";

class AuthMiddleware {
  static identifyUser = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (token) {
      try {
        const decoded = jwtService.verifyAccessToken(token);
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
        console.log("Invalid token");
      }
    }

    req.userType = "anonymous";
    next();
  });

  static requireRegisteredUser = (req: Request, _res: Response, next: NextFunction) => {
    if (req.userType !== "registered" || !req.user) {
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