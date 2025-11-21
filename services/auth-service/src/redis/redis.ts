// src/modules/sessionService/redis.service.ts

import { createClient, RedisClientType } from "redis";
import env from '@/config/env.config.js';

class RedisService {
  private client: RedisClientType;

  // Expiries (seconds)
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;
  private readonly TWO_FA_TEMP_EXPIRY = 300;

  constructor() {
    this.client = createClient({
      username: env.REDIS_USERNAME,
      password: env.REDIS_PASSWORD,
      socket: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT as unknown as number,
      },
    });

    this.client.on("connect", () => console.log("✅ Redis connected"));
    this.client.on("error", (err) => console.error("❌ Redis error:", err));

    this.client.connect();
  }

  // ---------------------------------------------------------------------------
  // KEY HELPERS
  // ---------------------------------------------------------------------------

  private refreshKey(userId: string, token: string) {
    return `refresh:${userId}:${token}`;
  }

  private twofaKey(userId: string) {
    return `2fa_temp:${userId}`;
  }

  private twofaLookupKey(token: string) {
    return `2fa_lookup:${token}`;
  }

  // ---------------------------------------------------------------------------
  // REFRESH TOKENS
  // ---------------------------------------------------------------------------

  async storeRefreshToken(userId: string, token: string, deviceInfo?: string) {
    const key = this.refreshKey(userId, token);

    const metadata = {
      userId,
      deviceInfo,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY * 1000).toISOString(),
    };

    await this.client.set(key, JSON.stringify(metadata), {
      EX: this.REFRESH_TOKEN_EXPIRY,
    });
  }

  async verifyRefreshToken(userId: string, token: string): Promise<boolean> {
    const key = this.refreshKey(userId, token);
    const raw = await this.client.get(key);

    if (!raw) return false;

    try {
      const metadata = JSON.parse(raw);

      // Double-check expiry
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
      console.log(`🔥 Logged out ${keys.length} sessions for user: ${userId}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TWO FACTOR TEMP TOKEN
  // ---------------------------------------------------------------------------

  async store2FAToken(userId: string, token: string): Promise<void> {
    await this.client.set(this.twofaKey(userId), token, { EX: this.TWO_FA_TEMP_EXPIRY });
    await this.client.set(this.twofaLookupKey(token), userId, { EX: this.TWO_FA_TEMP_EXPIRY });
  }

  async verify2FAToken(userId: string, token: string): Promise<boolean> {
    const stored = await this.client.get(this.twofaKey(userId));
    return stored === token;
  }

  async getUserIdFromTempToken(tempToken: string): Promise<string | null> {
    return await this.client.get(this.twofaLookupKey(tempToken));
  }

  async delete2FAToken(userId: string): Promise<void> {
    const token = await this.client.get(this.twofaKey(userId));

    await this.client.del(this.twofaKey(userId));

    if (token) {
      await this.client.del(this.twofaLookupKey(token));
    }
  }

  // ---------------------------------------------------------------------------
  // DISCONNECT
  // ---------------------------------------------------------------------------

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export default new RedisService();
