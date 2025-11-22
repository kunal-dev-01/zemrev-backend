declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        fullName: string;
        email: string;
        role: string;
        credits: number;
        status: "inactive" | "active";
        isEmailVerified: boolean;
      };
      guest?: {
        _id: string;
        guestId: string;
        fingerprint: string;
        ipAddress: string;
        dailyCreditsUsed: number;
        lastResetAt: Date;
      };
      userType?: "anonymous" | "guest" | "registered";
      creditInfo?: {
        total: number;
        used: number;
        remaining: number;
        resetDate?: Date; // Only for guests
      };
    }
  }
}

export {};