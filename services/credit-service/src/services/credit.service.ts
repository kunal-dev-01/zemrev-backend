import { User, GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import crypto from "crypto";

export default class CreditService {
  // ==========================================================
  // HELPERS
  // ==========================================================
  private static getStartOfToday(): Date {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }

  // ==========================================================
  // READ-ONLY QUERIES
  // ==========================================================
  static async userCredits(userId: string) {
    const user = await User.findById(userId).lean();
    if (!user) throw new AppError("User not found", 404);

    return {
      total: user.credits,
      used: 0,
      remaining: user.credits,
      status: user.status,
    };
  }

  static async guestCredits(fp: string, ip: string) {
    const startOfToday = this.getStartOfToday();

    // Prevent converted guests from using guest credits again
    const convertedGuest = await GuestUser.findOne({
      fingerprint: fp,
      isConverted: true,
    }).lean();

    if (convertedGuest) {
      throw new AppError(
        "This device has a registered account. Please login to continue.",
        403
      );
    }

    // Atomic credit hydrate + reset for guest
    const guest = await GuestUser.findOneAndUpdate(
      { fingerprint: fp },
      [
        {
          $set: {
            guestId: {
              $cond: {
                if: { $not: ["$guestId"] },
                then: crypto.randomBytes(16).toString("hex"),
                else: "$guestId",
              },
            },

            ipAddress: ip,

            // Reset daily credits if new day
            dailyCreditsUsed: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 0,
                else: "$dailyCreditsUsed",
              },
            },

            requestCount: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 0,
                else: "$requestCount",
              },
            },

            lastResetAt: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: startOfToday,
                else: "$lastResetAt",
              },
            },

            // Unblock guest if time served
            isBlocked: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: false,
                else: { $ifNull: ["$isBlocked", false] },
              },
            },
            blockedUntil: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: null,
                else: "$blockedUntil",
              },
            },
            blockedReason: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: null,
                else: "$blockedReason",
              },
            },
          },
        },
      ],
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    const used = guest.dailyCreditsUsed;
    const remaining = Math.max(
      0,
      CREDIT_PRICING.GUEST_DAILY_LIMIT - used
    );

    return {
      total: CREDIT_PRICING.GUEST_DAILY_LIMIT,
      used,
      remaining,
      resetAt: guest.lastResetAt,
    };
  }

  // ==========================================================
  // DEDUCTION: REGISTERED USER
  // ==========================================================
  static async deductUser(userId: string, cost: number) {
    const result = await User.findOneAndUpdate(
      {
        _id: userId,
        status: "active",
        isActive: true,
        isBlocked: false,
        $expr: { $gte: ["$credits", cost] },
      },
      { $inc: { credits: -cost } },
      { new: true }
    );

    if (!result) {
      const user = await User.findById(userId).lean();

      if (!user) throw new AppError("User not found", 404);
      if (user.status !== "active") throw new AppError("Account inactive", 403);
      if (user.isBlocked) throw new AppError("Account blocked", 403);
      if (user.credits < cost) {
        throw new AppError(`Need ${cost}, have ${user.credits}`, 429);
      }

      throw new AppError("Deduction failed", 500);
    }

    console.log(`💳 ${result.email} -${cost} ➜ ${result.credits}`);
  }

  // ==========================================================
  // DEDUCTION: GUEST (Atomic)
  // ==========================================================
  static async deductGuest(fp: string, ip: string, cost: number) {
    const startOfToday = this.getStartOfToday();

    const result = await GuestUser.findOneAndUpdate(
      {
        fingerprint: fp,
        $or: [
          { isBlocked: false },
          { isBlocked: true, blockedUntil: { $lte: new Date() } },
        ],
        $expr: {
          $lte: [
            {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: cost,
                else: { $add: ["$dailyCreditsUsed", cost] },
              },
            },
            CREDIT_PRICING.GUEST_DAILY_LIMIT,
          ],
        },
      },
      [
        {
          $set: {
            ipAddress: ip,

            // Reset daily count if new day
            dailyCreditsUsed: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: cost,
                else: { $add: ["$dailyCreditsUsed", cost] },
              },
            },

            requestCount: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 1,
                else: { $add: ["$requestCount", 1] },
              },
            },

            lastResetAt: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: startOfToday,
                else: "$lastResetAt",
              },
            },

            lastRequestTime: new Date(),

            // Unblock if time served
            isBlocked: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: false,
                else: "$isBlocked",
              },
            },
            blockedUntil: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: null,
                else: "$blockedUntil",
              },
            },
            blockedReason: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] },
                  ],
                },
                then: null,
                else: "$blockedReason",
              },
            },
          },
        },
      ],
      { new: true }
    );

    if (!result) {
      const guest = await GuestUser.findOne({ fingerprint: fp }).lean();
      if (!guest) throw new AppError("Guest not found", 404);

      if (guest.isBlocked && (!guest.blockedUntil || new Date() < guest.blockedUntil)) {
        throw new AppError(
          `Blocked until ${guest.blockedUntil!.toISOString()}`,
          403
        );
      }

      const isNewDay = guest.lastResetAt < startOfToday;
      const used = isNewDay ? 0 : guest.dailyCreditsUsed;
      const remaining = CREDIT_PRICING.GUEST_DAILY_LIMIT - used;

      if (remaining < cost) {
        throw new AppError(
          `Daily limit exhausted ${used}/${CREDIT_PRICING.GUEST_DAILY_LIMIT}`,
          429
        );
      }

      throw new AppError("Deduction failed", 500);
    }

    const remaining = CREDIT_PRICING.GUEST_DAILY_LIMIT - result.dailyCreditsUsed;
    console.log(`👤 guest=${result.guestId} -${cost} ➜ ${remaining}`);
  }

  // ==========================================================
  // ADMIN UTILITIES
  // ==========================================================
  static async refund(userId: string, amount: number, reason?: string) {
    if (amount <= 0) throw new AppError("Amount > 0 required", 400);

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: amount } },
      { new: true }
    );

    if (!user) throw new AppError("User not found", 404);

    console.log(`🔄 ${user.email} +${amount} reason=${reason ?? "-"}`);
  }

  static async stats() {
    const [userStats, guestStats] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            credits: { $sum: "$credits" },
            avg: { $avg: "$credits" },
          },
        },
      ]),
      GuestUser.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: { $cond: [{ $gt: ["$dailyCreditsUsed", 0] }, 1, 0] },
            },
            used: { $sum: "$dailyCreditsUsed" },
          },
        },
      ]),
    ]);

    return {
      users: userStats[0] || { total: 0, active: 0, credits: 0, avg: 0 },
      guests: guestStats[0] || { total: 0, active: 0, used: 0 },
    };
  }
}
