import { GuestUser, RATE_LIMITS } from "@zemrev/models";
import { AppError } from "@zemrev/utils";

export default class AbuseDetectionService {
  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private static async block(guest: any, mins: number, reason: string) {
    guest.isBlocked = true;
    guest.blockedUntil = new Date(Date.now() + mins * 60 * 1000);
    guest.blockedReason = reason;
    await guest.save();
    console.log(`🚫 ${guest.guestId}  ${reason}  ${mins}m`);
  }

  // ----------------------------------------------------------
  // Rate-limit guest requests
  // ----------------------------------------------------------
  static async rateLimit(fp: string): Promise<void> {
    const g = await GuestUser.findOne({ fingerprint: fp });
    if (!g) return;

    const now = Date.now();
    const last = new Date(g.lastRequestTime).getTime();

    // reset counter after 1 min
    if (now - last >= 60_000) g.requestCount = 0;

    if (now - last < 60_000 && g.requestCount >= RATE_LIMITS.GUEST.REQUESTS_PER_MINUTE) {
      await this.block(g, RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES, "Too many requests per minute");
      throw new AppError(`Rate limit exceeded. Blocked for ${RATE_LIMITS.GUEST.BLOCK_DURATION_MINUTES} minutes.`, 429);
    }

    g.requestCount += 1;
    g.lastRequestTime = new Date(now);
    await g.save();
  }

  // ----------------------------------------------------------
  // One-account-per-device-per-day
  // ----------------------------------------------------------
  static async multiAccount(fp: string): Promise<void> {
    const g = await GuestUser.findOne({ fingerprint: fp, isConverted: true });
    if (!g?.convertedAt) return;

    const sameDay = (d: Date) => new Date().toISOString().slice(0, 10) === d.toISOString().slice(0, 10);
    if (sameDay(new Date(g.convertedAt)))
      throw new AppError("Device already used for sign-up today. Please log in.", 403);
  }

  // ----------------------------------------------------------
  // Cookie-clear loop detection
  // ----------------------------------------------------------
  static async logoutLoop(fp: string, ip: string): Promise<void> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await GuestUser.countDocuments({ ipAddress: ip, createdAt: { $gte: dayAgo } });

    if (count > 5) {
      console.log(`⚠️ ${ip}  ${count} guests in 24h`);
      await GuestUser.updateMany(
        { ipAddress: ip },
        { $set: { isBlocked: true, blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), blockedReason: "IP spam" } }
      );
      throw new AppError("Suspicious activity detected. Contact support.", 403);
    }
  }

  // ----------------------------------------------------------
  // Log user ↔ guest quick switch (monitor only)
  // ----------------------------------------------------------
  static async quickSwitch(uid: string, fp?: string): Promise<void> {
    if (!fp) return;
    const g = await GuestUser.findOne({ fingerprint: fp });
    if (!g) return;

    const oneHour = Date.now() - 60 * 60 * 1000;
    if (new Date(g.lastRequestTime).getTime() > oneHour && g.dailyCreditsUsed > 0)
      console.log(`⚠️ ${uid} using guest credits after recent guest activity`);
  }

}