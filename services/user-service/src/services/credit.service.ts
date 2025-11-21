import { User, GuestUser, PlanType } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

class CreditService {
  static async getUserCredits(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (user.planType !== PlanType.CUSTOM) {
      await this.checkAndResetDailyCredits(user);
    }

    return {
      total: user.credits as number,
      used: user.creditsUsed as number,
      remaining: Math.max(0, user.credits - user.creditsUsed) as number,
      resetDate: user.planType !== PlanType.CUSTOM ? user.nextCreditReset : undefined,
      planType: user.planType,
      planActive: user.planActive,
    };
  }

  static async getGuestCredits(fingerprint: string): Promise<any> {
    const guest = await GuestUser.findOne({ fingerprint });
    if (!guest) throw new AppError("Guest not found", 404);

    await this.checkAndResetGuestCredits(guest);

    return {
      total: 15,
      used: guest.creditsUsed,
      remaining: Math.max(0, 15 - guest.creditsUsed),
      resetDate: guest.lastResetDate,
    };
  }

  static async checkAndResetDailyCredits(user: any): Promise<void> {
    if (user.planType === PlanType.CUSTOM) return;

    const now = new Date();
    const nextReset = new Date(user.nextCreditReset);

    if (now >= nextReset) {
      user.creditsUsed = 0;

      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      user.nextCreditReset = tomorrow;

      user.credits = user.plan.dailyCredits;

      await user.save();
      console.log(`✅ Daily credits reset: ${user.email} | Plan: ${user.planType}`);
    }
  }

  static async checkAndResetGuestCredits(guest: any): Promise<void> {
    const now = new Date();
    const lastReset = new Date(guest.lastResetDate);

    const isSameDay = (
      now.getUTCFullYear() === lastReset.getUTCFullYear() &&
      now.getUTCMonth() === lastReset.getUTCMonth() &&
      now.getUTCDate() === lastReset.getUTCDate()
    );

    if (!isSameDay) {
      guest.creditsUsed = 0;
      guest.requestCount = 0;
      guest.lastResetDate = now;
      await guest.save();
      console.log(`✅ Guest credits reset: ${guest.fingerprint}`);
    }
  }

  static async deductUserCredits(
    userId: string,
    creditsNeeded: number
  ): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    if (!user.planActive) {
      throw new AppError("Plan not active. Complete payment to continue.", 403);
    }

    if (user.planType !== PlanType.CUSTOM) {
      await this.checkAndResetDailyCredits(user);
    }

    const remaining = user.credits - user.creditsUsed;

    if (remaining < creditsNeeded) {
      const resetInfo =
        user.planType !== PlanType.CUSTOM
          ? `Resets at ${new Date(user.nextCreditReset).toLocaleString(
              "en-US",
              { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }
            )} UTC.`
          : "Buy more credits to continue.";

      throw new AppError(
        `Insufficient credits. You have ${remaining}/${user.credits} remaining. ${resetInfo}`,
        429
      );
    }

    user.creditsUsed += creditsNeeded;
    await user.save();
  }

  static async deductGuestCredits(
    fingerprint: string,
    creditsNeeded: number
  ): Promise<void> {
    const guest = await GuestUser.findOne({ fingerprint });
    if (!guest) throw new AppError("Guest not found", 404);

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
      guest.requestCount = 0;
    }

    await this.checkAndResetGuestCredits(guest);

    const remaining = 15 - guest.creditsUsed;

    if (remaining < creditsNeeded) {
      throw new AppError(
        `Daily limit reached. Used ${guest.creditsUsed}/15. Resets at midnight UTC.`,
        429
      );
    }

    guest.creditsUsed += creditsNeeded;
    await guest.save();
  }

  static async refundCredits(userId: string, amount: number): Promise<void> {
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", 404);

    user.creditsUsed = Math.max(0, user.creditsUsed - amount);
    await user.save();
    console.log(`🔄 Refunded ${amount} credits to ${user.email}`);
  }
}

export default CreditService;