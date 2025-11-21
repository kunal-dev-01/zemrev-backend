import { createClient, RedisClientType } from "redis";

class RedisService {
  private client: RedisClientType;
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
  private readonly TWO_FA_TEMP_EXPIRY = 300; // 5 min

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    this.client = createClient({
      url: redisUrl,
    });

    this.client.on("connect", () => console.log("✅ Redis connected"));
    this.client.on("error", (err) =>
      console.error("❌ Redis connection error:", err)
    );

    this.client.connect().catch((err) => {
      console.error("❌ Failed to connect to Redis:", err);
      process.exit(1);
    });
  }

  private refreshKey(userId: string, token: string) {
    return `refresh:${userId}:${token}`;
  }

  private twofaKey(userId: string) {
    return `2fa_temp:${userId}`;
  }

  // REFRESH TOKENS
  async storeRefreshToken(
    userId: string,
    token: string,
    deviceInfo?: string
  ): Promise<void> {
    const key = this.refreshKey(userId, token);
    const metadata = {
      userId,
      deviceInfo,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(
        Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000
      ).toISOString(),
    };
    await this.client.setEx(
      key,
      this.REFRESH_TOKEN_EXPIRY,
      JSON.stringify(metadata)
    );
  }

  async verifyRefreshToken(
    userId: string,
    token: string
  ): Promise<boolean> {
    const key = this.refreshKey(userId, token);
    const raw = await this.client.get(key);
    if (!raw) return false;

    try {
      const metadata = JSON.parse(raw);
      if (new Date(metadata.expiresAt) < new Date()) {
        await this.deleteRefreshToken(userId, token);
        return false;
      }
      return true;
    } catch {
      await this.deleteRefreshToken(userId, token);
      return false;
    }
  }

  async deleteRefreshToken(userId: string, token: string): Promise<void> {
    await this.client.del(this.refreshKey(userId, token));
  }

  async logoutAllDevices(userId: string): Promise<void> {
    const pattern = `refresh:${userId}:*`;
    const keys: string[] = [];
    let cursor = "0";

    do {
      const reply = await this.client.scan(cursor, {
        MATCH: pattern,
        COUNT: 200,
      });
      cursor = reply.cursor;
      keys.push(...reply.keys);
    } while (cursor !== "0");

    if (keys.length > 0) {
      await this.client.del(keys);
      console.log(
        `🔥 Cleared ${keys.length} active sessions for user ${userId}`
      );
    }
  }

  // 2FA TEMP TOKEN
  async store2FAToken(userId: string, token: string): Promise<void> {
    await this.client.setEx(this.twofaKey(userId), this.TWO_FA_TEMP_EXPIRY, token);
    await this.client.setEx(`2fa_lookup:${token}`, this.TWO_FA_TEMP_EXPIRY, userId);
  }

  async verify2FAToken(userId: string, token: string): Promise<boolean> {
    const stored = await this.client.get(this.twofaKey(userId));
    return stored === token;
  }

  async getUserIdFromTempToken(tempToken: string): Promise<string | null> {
    return await this.client.get(`2fa_lookup:${tempToken}`);
  }

  async delete2FAToken(userId: string): Promise<void> {
    const token = await this.client.get(this.twofaKey(userId));
    await this.client.del(this.twofaKey(userId));
    if (token) {
      await this.client.del(`2fa_lookup:${token}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export default new RedisService();