import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import crypto from "crypto";
import env from "@/config/env.config.js";
import { User } from "@zemrev/models";
import { AppError, JWTService } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";
import { AbuseDetectionService } from "@zemrev/config";
import { sanitizeUser } from "./auth.service.js";

// ==========================================================
// CONSTANTS
// ==========================================================
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ==========================================================
// TYPES
// ==========================================================
interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  verified_email?: boolean;
}

class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URI
    );
  }

  // ==========================================================
  // BUILD GOOGLE AUTH URL
  // ==========================================================
  getGoogleAuthURL(fingerprint?: string): string {
    const stateToken = crypto.randomBytes(32).toString("hex");

    const stateData = {
      token: stateToken,
      fingerprint: fingerprint ?? null,
      timestamp: Date.now(),
    };

    redisService.storeOAuthState(stateToken, stateData);

    const params = new URLSearchParams({
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: GOOGLE_SCOPES.join(" "),
      state: stateToken,
    });

    const url = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    return fingerprint ? `${url}&fp=${fingerprint}` : url;
  }

  // ==========================================================
  // HANDLE GOOGLE CALLBACK
  // ==========================================================
  async handleGoogleCallback(
    code: string,
    state: string,
    fingerprint?: string
  ) {
    try {
      const stateData = await redisService.getOAuthState(state);
      if (!stateData) {
        throw new AppError("Invalid or expired state token", 401);
      }

      // fingerprint lock
      if (stateData.fingerprint) {
        if (!fingerprint) {
          console.warn("⚠️ Fingerprint expected but not received");
        } else if (fingerprint !== stateData.fingerprint) {
          throw new AppError("Security validation failed", 403);
        }
      }

      // One-account-per-device safeguard
      if (fingerprint) {
        await AbuseDetectionService.multiAccount(fingerprint);
      }

      await redisService.deleteOAuthState(state);

      // Exchange code → Google tokens
      const { tokens } = await this.client.getToken(code);
      if (!tokens.access_token) {
        throw new AppError("Failed to obtain Google access token", 401);
      }

      this.client.setCredentials(tokens);

      // Fetch Google profile
      const googleUser = await this.getGoogleUserInfo(tokens.access_token);

      // Create or connect user
      const user = await User.findOrCreateGoogleUser(
        {
          googleId: googleUser.id,
          email: googleUser.email,
          name: googleUser.name ?? "",
          avatar: googleUser.picture ?? "",
        },
        fingerprint
      );

      // JWT pair
      const jwtTokens = JWTService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      await redisService.storeRefreshToken(
        user._id.toString(),
        jwtTokens.refreshToken
      );

      return {
        user: sanitizeUser(user),
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
      };
    } catch (err) {
      console.error("❌ Google OAuth Error:", err);
      if (err instanceof AppError) throw err;
      throw new AppError("Google authentication failed", 401);
    }
  }

  // ==========================================================
  // FETCH GOOGLE USER INFO
  // ==========================================================
  private async getGoogleUserInfo(
    accessToken: string
  ): Promise<GoogleUserInfo> {
    try {
      const { data } = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!data.id || !data.email) {
        throw new AppError("Invalid Google user data", 400);
      }

      return data;
    } catch (err) {
      console.error("❌ Failed to fetch Google user info:", err);
      throw new AppError("Google user information fetch failed", 401);
    }
  }
}

export default new GoogleAuthService();
