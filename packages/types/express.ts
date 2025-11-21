import { PlanType, UserRole } from "@zemrev/models";

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        fullName: string;
        email: string;
        role: UserRole;
        plan: any;
        planType: PlanType;
        planActive: boolean;
        creditsUsed: number;
        isEmailVerified: boolean;
      };

      guest?: {
        _id: string;
        fingerprint: string;
        ipAddress: string;
        creditsUsed: number;
        lastResetDate: Date;
      };

      userType: "guest" | "registered" | "anonymous";

      creditInfo: {
        total: number | string;
        used: number;
        remaining: number | string;
        resetDate?: Date;
      };
    }
  }
}