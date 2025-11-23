import { GuestUser, RATE_LIMITS } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

export default class AbuseDetectionService {
  // ----------------------------------------------------------
  // ATOMIC RATE LIMIT (No race conditions)
  // ----------------------------------------------------------
  static async rateLimit(fp: string): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);

    // ✅ ATOMIC: Increment + check in single operation
    const result = await GuestUser.findOneAndUpdate(
      {
        fingerprint: fp,
        $or: [
          // Case 1: Not blocked
          { isBlocked: false },
          // Case 2: Blocked but time served
          { 
            isBlocked: true, 
            blockedUntil: { $lte: now } 
          }
        ],
        // ✅ PREVENT INCREMENT IF ALREADY AT LIMIT
        $expr: {
          $or: [
            // Reset counter if > 1 min passed
            { $lt: ["$lastRequestTime", oneMinuteAgo] },
            // Or still under limit
            { $lt: ["$requestCount", RATE_LIMITS.GUEST.REQUESTS_PER_MINUTE] }
          ]
        }
      },
      [
        {
          $set: {
            // ✅ RESET COUNT IF > 1 MIN
            requestCount: {
              $cond: {
                if: { $lt: ["$lastRequestTime", oneMinuteAgo] },
                then: 1,
                else: { $add: ["$requestCount", 1] }
              }
            },
            lastRequestTime: now,
            // ✅ UNBLOCK IF TIME SERVED
            isBlocked: {
              $cond: {
                if: {
                  $and: [
                    "$isBlocked",
                    { $gte: [now, "$blockedUntil"] }
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
                    { $gte: [now, "$blockedUntil"] }
                  ]
                },
                then: null,
                else: "$blockedUntil"
              }
            }
          }
        }
      ],
      { new: true }
    );

    if (!result) {
      const g = await GuestUser.findOne({ fingerprint: fp }).lean();
      
      if (!g) return; // New guest, will be created on credit check
      
      // ✅ CHECK IF BLOCKED
      if (g.isBlocked && (!g.blockedUntil || now < g.blockedUntil)) {
        throw new AppError(
          `Rate limit exceeded. Blocked until ${g.blockedUntil!.toISOString()}`,
          429
        );
      }

      // ✅ CHECK IF AT LIMIT
      const timeSinceLastRequest = now.getTime() - new Date(g.lastRequestTime).getTime();
      if (timeSinceLastRequest < 60_000 && g.requestCount >= RATE_LIMITS.GUEST.REQUESTS_PER_MINUTE) {
        // ✅ BLOCK THE GUEST
        await GuestUser.findOneAndUpdate(
          { fingerprint: fp },
          {
            isBlocked: true,
            blockedUntil: new Date(now.getTime() + RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES * 60_000),
            blockedReason: "Too many requests per minute"
          }
        );

        console.log(`🚫 ${g.guestId} blocked for ${RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES}m`);
        
        throw new AppError(
          `Rate limit exceeded. Blocked for ${RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES} minutes.`,
          429
        );
      }
    }
  }

  // ----------------------------------------------------------
  // ONE ACCOUNT PER DEVICE PER DAY (Check before signup/Google)
  // ----------------------------------------------------------
  static async multiAccount(fp: string): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);

    const g = await GuestUser.findOne({
      fingerprint: fp,
      isConverted: true,
      convertedAt: { $gte: startOfToday }
    }).lean();

    if (g) {
      throw new AppError(
        "This device already created an account today. Please login.",
        403
      );
    }
  }

  // ----------------------------------------------------------
  // COOKIE-CLEAR LOOP DETECTION (IP-based)
  // ----------------------------------------------------------
  static async logoutLoop(fp: string, ip: string): Promise<void> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const count = await GuestUser.countDocuments({ 
      ipAddress: ip, 
      createdAt: { $gte: dayAgo } 
    });

    if (count > 5) {
      console.log(`⚠️ ${ip} ${count} guests in 24h`);
      
      // ✅ BLOCK ALL GUESTS FROM THIS IP
      await GuestUser.updateMany(
        { ipAddress: ip },
        {
          $set: {
            isBlocked: true,
            blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
            blockedReason: "IP spam detection"
          }
        }
      );

      throw new AppError(
        "Suspicious activity detected. Contact support.",
        403
      );
    }
  }

  // ----------------------------------------------------------
  // QUICK-SWITCH DETECTION (User ↔ Guest abuse)
  // ----------------------------------------------------------
  static async quickSwitch(uid: string, fp?: string): Promise<void> {
    if (!fp) return;

    const oneHour = Date.now() - 60 * 60 * 1000;

    const g = await GuestUser.findOne({
      fingerprint: fp,
      lastRequestTime: { $gte: new Date(oneHour) },
      dailyCreditsUsed: { $gt: 0 }
    }).lean();

    if (g) {
      console.log(`⚠️ User ${uid} quick-switched from guest ${g.guestId}`);
      // ✅ LOG ONLY (No block - legitimate use case)
    }
  }
}