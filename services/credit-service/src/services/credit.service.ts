import { User, GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import crypto from "crypto";

export default class CreditService {
  // ----------------------------------------------------------
  // HELPER: Get start of today (UTC)
  // ----------------------------------------------------------
  private static getStartOfToday(): Date {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }

  // ----------------------------------------------------------
  // QUERIES (Read-only)
  // ----------------------------------------------------------
  static async userCredits(userId: string) {
    const u = await User.findById(userId).lean();
    if (!u) throw new AppError("User not found", 404);
    return { 
      total: u.credits, 
      used: 0, 
      remaining: u.credits, 
      status: u.status 
    };
  }

  static async guestCredits(fp: string, ip: string) {
    const startOfToday = this.getStartOfToday();

    // ✅ ATOMIC: findOneAndUpdate with upsert + conditional reset
    const g = await GuestUser.findOneAndUpdate(
      { fingerprint: fp },
      [
        {
          $set: {
            guestId: {
              $cond: {
                if: { $not: ["$guestId"] },
                then: crypto.randomBytes(16).toString("hex"),
                else: "$guestId"
              }
            },
            ipAddress: ip,
            // ✅ RESET ONLY IF NEW DAY (no extra write)
            dailyCreditsUsed: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 0,
                else: "$dailyCreditsUsed"
              }
            },
            requestCount: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 0,
                else: "$requestCount"
              }
            },
            lastResetAt: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: startOfToday,
                else: "$lastResetAt"
              }
            },
            // ✅ UNBLOCK IF TIME SERVED
            isBlocked: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: false,
                else: { $ifNull: ["$isBlocked", false] }
              }
            },
            blockedUntil: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: null,
                else: "$blockedUntil"
              }
            },
            blockedReason: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: null,
                else: "$blockedReason"
              }
            }
          }
        }
      ],
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true
      }
    );

    const used = g.dailyCreditsUsed;
    const rem = Math.max(0, CREDIT_PRICING.GUEST_DAILY_LIMIT - used);
    
    return { 
      total: CREDIT_PRICING.GUEST_DAILY_LIMIT, 
      used, 
      remaining: rem, 
      resetAt: g.lastResetAt 
    };
  }

  // ----------------------------------------------------------
  // DEDUCTION (Atomic)
  // ----------------------------------------------------------
  static async deductUser(userId: string, cost: number) {
    // ✅ ATOMIC: Single operation with validation
    const result = await User.findOneAndUpdate(
      {
        _id: userId,
        status: "active",
        isActive: true,
        isBlocked: false,
        $expr: { $gte: ["$credits", cost] }
      },
      { $inc: { credits: -cost } },
      { new: true }
    );

    if (!result) {
      const u = await User.findById(userId).lean();
      if (!u) throw new AppError("User not found", 404);
      if (u.status !== "active") throw new AppError("Account inactive", 403);
      if (u.isBlocked) throw new AppError("Account blocked", 403);
      if (u.credits < cost) throw new AppError(`Need ${cost}, have ${u.credits}`, 429);
      throw new AppError("Deduction failed", 500);
    }

    console.log(`💳 ${result.email} -${cost} ➜ ${result.credits}`);
  }

  static async deductGuest(fp: string, ip: string, cost: number) {
    const startOfToday = this.getStartOfToday();

    // ✅ ATOMIC: Single operation with all checks + reset + deduction
    const result = await GuestUser.findOneAndUpdate(
      {
        fingerprint: fp,
        $or: [
          { isBlocked: false },
          { 
            isBlocked: true, 
            blockedUntil: { $lte: new Date() } 
          }
        ],
        $expr: {
          $lte: [
            {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: cost,
                else: { 
                  $add: [
                    "$dailyCreditsUsed", 
                    cost
                  ] 
                }
              }
            },
            CREDIT_PRICING.GUEST_DAILY_LIMIT
          ]
        }
      },
      [
        {
          $set: {
            ipAddress: ip,
            // ✅ RESET IF NEW DAY
            dailyCreditsUsed: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: cost,
                else: { $add: ["$dailyCreditsUsed", cost] }
              }
            },
            requestCount: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: 1,
                else: { $add: ["$requestCount", 1] }
              }
            },
            lastResetAt: {
              $cond: {
                if: { $lt: ["$lastResetAt", startOfToday] },
                then: startOfToday,
                else: "$lastResetAt"
              }
            },
            lastRequestTime: new Date(),
            // ✅ UNBLOCK IF TIME SERVED
            isBlocked: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: false,
                else: "$isBlocked"
              }
            },
            blockedUntil: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: null,
                else: "$blockedUntil"
              }
            },
            blockedReason: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [new Date(), "$blockedUntil"] }
                  ]
                },
                then: null,
                else: "$blockedReason"
              }
            }
          }
        }
      ],
      { new: true }
    );

    if (!result) {
      const g = await GuestUser.findOne({ fingerprint: fp }).lean();
      
      if (!g) throw new AppError("Guest not found", 404);
      
      if (g.isBlocked && (!g.blockedUntil || new Date() < g.blockedUntil)) {
        throw new AppError(
          `Blocked until ${g.blockedUntil!.toISOString()}`, 
          403
        );
      }

      const isNewDay = g.lastResetAt < startOfToday;
      const used = isNewDay ? 0 : g.dailyCreditsUsed;
      const remaining = CREDIT_PRICING.GUEST_DAILY_LIMIT - used;

      if (remaining < cost) {
        throw new AppError(
          `Daily limit exhausted ${used}/${CREDIT_PRICING.GUEST_DAILY_LIMIT}`, 
          429
        );
      }

      throw new AppError("Deduction failed", 500);
    }

    const rem = CREDIT_PRICING.GUEST_DAILY_LIMIT - result.dailyCreditsUsed;
    console.log(`👤 guest=${result.guestId} -${cost} ➜ ${rem}`);
  }

  // ----------------------------------------------------------
  // ADMIN UTILS
  // ----------------------------------------------------------
  static async refund(userId: string, amount: number, reason?: string) {
    if (amount <= 0) throw new AppError("Amount > 0 required", 400);
    
    const u = await User.findByIdAndUpdate(
      userId,
      { $inc: { credits: amount } },
      { new: true }
    );

    if (!u) throw new AppError("User not found", 404);
    
    console.log(`🔄 ${u.email} +${amount} reason=${reason ?? "-"}`);
  }

  static async stats() {
    const [u, g] = await Promise.all([
      User.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
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
            active: { $sum: { $cond: [{ $gt: ["$dailyCreditsUsed", 0] }, 1, 0] } },
            used: { $sum: "$dailyCreditsUsed" },
          },
        },
      ]),
    ]);

    return { 
      users: u[0] || { total: 0, active: 0, credits: 0, avg: 0 }, 
      guests: g[0] || { total: 0, active: 0, used: 0 } 
    };
  }
}