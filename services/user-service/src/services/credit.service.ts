import { User, GuestUser, CREDIT_PRICING } from "@zemrev/models";
import { AppError } from "@zemrev/utils";
import crypto from "crypto";

export default class CreditService {
  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------
  private static async guest(fingerprint: string, ip: string) {
    let g = await GuestUser.findOne({ fingerprint });
    if (!g) {
      g = await GuestUser.create({
        guestId: crypto.randomBytes(16).toString("hex"),
        fingerprint,
        ipAddress: ip,
        dailyCreditsUsed: 0,
        lastResetAt: new Date(),
      });
      console.log(`🆕 guest=${g.guestId}`);
    }
    return g;
  }

  private static async resetIfNewDay(g: any) {
    const now = new Date();
    const last = new Date(g.lastResetAt);
    const sameDay =
      now.getUTCFullYear() === last.getUTCFullYear() &&
      now.getUTCMonth() === last.getUTCMonth() &&
      now.getUTCDate() === last.getUTCDate();

    if (!sameDay) {
      g.dailyCreditsUsed = 0;
      g.requestCount = 0;
      g.lastResetAt = now;
      await g.save();
      console.log(`✅ reset guest=${g.guestId}`);
    }
  }

  // ----------------------------------------------------------
  // Queries
  // ----------------------------------------------------------
  static async userCredits(userId: string) {
    const u = await User.findById(userId).lean();
    if (!u) throw new AppError("User not found", 404);
    return { total: u.credits, used: 0, remaining: u.credits, status: u.status };
  }

  static async guestCredits(fp: string, ip: string) {
    const g = await this.guest(fp, ip);
    await this.resetIfNewDay(g);
    const used = g.dailyCreditsUsed;
    const rem = Math.max(0, CREDIT_PRICING.GUEST_DAILY_LIMIT - used);
    return { total: CREDIT_PRICING.GUEST_DAILY_LIMIT, used, remaining: rem, resetAt: g.lastResetAt };
  }

  // ----------------------------------------------------------
  // Deduction
  // ----------------------------------------------------------
  static async deductUser(userId: string, cost: number) {
    const u = await User.findById(userId);
    if (!u) throw new AppError("User not found", 404);
    if (u.status !== "active") throw new AppError("Account inactive", 403);
    if (u.credits < cost)
      throw new AppError(`Need ${cost}, have ${u.credits}`, 429);

    const res = await User.findByIdAndUpdate(userId, { $inc: { credits: -cost } }, { new: true });
    console.log(`💳 ${u.email} -${cost}  ➜  ${res!.credits}`);
  }

  static async deductGuest(fp: string, ip: string, cost: number) {
    const g = await this.guest(fp, ip);

    // unblock if time served
    if (g.isBlocked && g.blockedUntil && new Date() >= g.blockedUntil) {
      g.isBlocked = false;
      g.blockedUntil = undefined;
      g.blockedReason = undefined;
      g.requestCount = 0;
    }

    if (g.isBlocked)
      throw new AppError(`Blocked until ${g.blockedUntil!.toISOString()}`, 403);

    await this.resetIfNewDay(g);

    const rem = CREDIT_PRICING.GUEST_DAILY_LIMIT - g.dailyCreditsUsed;
    if (rem < cost)
      throw new AppError(`Daily limit exhausted  ${g.dailyCreditsUsed}/${CREDIT_PRICING.GUEST_DAILY_LIMIT}`, 429);

    g.dailyCreditsUsed += cost;
    g.requestCount += 1;
    g.lastRequestTime = new Date();
    await g.save();

    console.log(`👤 guest=${g.guestId} -${cost}  ➜  ${rem - cost}`);
  }

  // ----------------------------------------------------------
  // Admin utils
  // ----------------------------------------------------------
  static async refund(userId: string, amount: number, reason?: string) {
    if (amount <= 0) throw new AppError("Amount > 0 required", 400);
    const u = await User.findById(userId);
    if (!u) throw new AppError("User not found", 404);
    u.credits += amount;
    await u.save();
    console.log(`🔄 ${u.email} +${amount}  reason=${reason ?? "-"}`);
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

    return { users: u[0] || { total: 0, active: 0, credits: 0, avg: 0 }, guests: g[0] || { total: 0, active: 0, used: 0 } };
  }
}