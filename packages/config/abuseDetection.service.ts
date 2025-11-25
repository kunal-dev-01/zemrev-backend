import { GuestUser, RATE_LIMITS } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

export default class AbuseDetectionService {
  // ==========================================================
  // ATOMIC RATE LIMIT (Increment + Check)
  // ==========================================================
  static async rateLimit(fp: string): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);

    const result = await GuestUser.findOneAndUpdate(
      {
        fingerprint: fp,
        $or: [
          { isBlocked: false },
          {
            isBlocked: true,
            blockedUntil: { $lte: now },
          },
        ],
        $expr: {
          $or: [
            { $lt: ["$lastRequestTime", oneMinuteAgo] },
            { $lt: ["$requestCount", RATE_LIMITS.GUEST.REQUESTS_PER_MINUTE] },
          ],
        },
      },
      [
        {
          $set: {
            requestCount: {
              $cond: {
                if: { $lt: ["$lastRequestTime", oneMinuteAgo] },
                then: 1,
                else: { $add: ["$requestCount", 1] },
              },
            },
            lastRequestTime: now,
            isBlocked: {
              $cond: {
                if: {
                  $and: ["$isBlocked", { $gte: [now, "$blockedUntil"] }],
                },
                then: false,
                else: { $ifNull: ["$isBlocked", false] },
              },
            },
            blockedUntil: {
              $cond: {
                if: {
                  $and: ["$isBlocked", { $gte: [now, "$blockedUntil"] }],
                },
                then: null,
                else: "$blockedUntil",
              },
            },
          },
        },
      ],
      { new: true }
    );

    if (result) return;

    const existing = await GuestUser.findOne({ fingerprint: fp }).lean();
    if (!existing) return;

    // Already blocked
    if (existing.isBlocked && (!existing.blockedUntil || now < existing.blockedUntil)) {
      throw new AppError(
        `Rate limit exceeded. Blocked until ${existing.blockedUntil!.toISOString()}`,
        429
      );
    }

    const timeSinceLast = now.getTime() - new Date(existing.lastRequestTime).getTime();

    if (
      timeSinceLast < 60_000 &&
      existing.requestCount >= RATE_LIMITS.GUEST.REQUESTS_PER_MINUTE
    ) {
      await GuestUser.findOneAndUpdate(
        { fingerprint: fp },
        {
          isBlocked: true,
          blockedUntil: new Date(
            now.getTime() +
              RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES * 60_000
          ),
          blockedReason: "Too many requests per minute",
        }
      );

      console.log(
        `🚫 ${existing.guestId} blocked for ${RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES}m`
      );

      throw new AppError(
        `Rate limit exceeded. Blocked for ${RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES} minutes.`,
        429
      );
    }
  }

  // ==========================================================
  // ONE ACCOUNT PER DEVICE PER DAY
  // ==========================================================
  static async multiAccount(fp: string): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const found = await GuestUser.findOne({
      fingerprint: fp,
      isConverted: true,
      convertedAt: { $gte: startOfToday },
    }).lean();

    if (found) {
      throw new AppError(
        "This device already created an account today. Please login.",
        403
      );
    }
  }

  // ==========================================================
  // COOKIE-CLEAR LOOP (IP-Based Abuse)
  // ==========================================================
  static async logoutLoop(fp: string, ip: string): Promise<void> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const count = await GuestUser.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: dayAgo },
    });

    if (count > 5) {
      console.log(`⚠️ ${ip} ${count} guests in 24h`);

      await GuestUser.updateMany(
        { ipAddress: ip },
        {
          $set: {
            isBlocked: true,
            blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
            blockedReason: "IP spam detection",
          },
        }
      );

      throw new AppError(
        "Suspicious activity detected. Contact support.",
        403
      );
    }
  }

  // ==========================================================
  // ADVANCED GUEST CHECKS
  // ==========================================================
  static async enhancedGuestCheck(ip: string, userAgent: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Too many guests from same IP
    const guestsFromIP = await GuestUser.countDocuments({
      ipAddress: ip,
      createdAt: { $gte: today },
    });

    if (guestsFromIP > 3) {
      throw new AppError(
        "Too many accounts from this network today. Please login or try again tomorrow.",
        429
      );
    }

    // Same UserAgent (bot pattern)
    const guestsWithUA = await GuestUser.countDocuments({
      userAgent,
      createdAt: { $gte: today },
    });

    if (guestsWithUA > 5) {
      throw new AppError(
        "Suspicious activity detected. Please use a registered account.",
        403
      );
    }
  }

  // ==========================================================
  // QUICK SWITCH DETECTION (User → Guest Abuse)
  // ==========================================================
  static async quickSwitch(uid: string, fp?: string): Promise<void> {
    if (!fp) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const guest = await GuestUser.findOne({
      fingerprint: fp,
      lastRequestTime: { $gte: oneHourAgo },
      dailyCreditsUsed: { $gt: 0 },
    }).lean();

    if (guest) {
      console.log(
        `⚠️ User ${uid} quick-switched from guest ${guest.guestId}`
      );
    }
  }
}
