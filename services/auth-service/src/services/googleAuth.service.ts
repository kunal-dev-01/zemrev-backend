import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import env from "@/config/env.config.js";
import { User } from "@zemrev/models";
import { AppError, JWTService } from "@zemrev/utils";
import { redisService } from "@zemrev/redis";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

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

  /**
   * ---------------------------------------------------------
   * Generate the Google OAuth URL for frontend
   * ---------------------------------------------------------
   */
  getGoogleAuthURL(): string {
    const params = new URLSearchParams({
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: GOOGLE_SCOPES.join(" "),
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * ---------------------------------------------------------
   * Handle Google OAuth callback
   * ---------------------------------------------------------
   */
  async handleGoogleCallback(code: string) {
    try {
      const { tokens } = await this.client.getToken(code);

      if (!tokens.access_token)
        throw new AppError("Failed to obtain Google access token", 401);

      this.client.setCredentials(tokens);

      const googleUser = await this.getGoogleUserInfo(tokens.access_token);

      const user = await User.findOrCreateGoogleUser({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name ?? "",
        avatar: googleUser.picture ?? "",
      });

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
        user: this.formatUser(user),
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        requiresPayment: false,
      };
    } catch (error) {
      console.error("❌ Google OAuth Error:", error);
      throw new AppError("Google authentication failed", 401);
    }
  }

  /**
   * ---------------------------------------------------------
   * Fetch Google User Info
   * ---------------------------------------------------------
   */
  private async getGoogleUserInfo(
    accessToken: string
  ): Promise<GoogleUserInfo> {
    try {
      const { data } = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!data.id || !data.email)
        throw new AppError("Invalid Google user data", 400);

      return data;
    } catch (error) {
      console.error("❌ Failed to fetch Google user info:", error);
      throw new AppError("Google user information fetch failed", 401);
    }
  }

  /**
   * ---------------------------------------------------------
   * Format user response (DRY)
   * ---------------------------------------------------------
   */
  private formatUser(user: any) {
    return {
      fullName: user.fullName,
      email: user.email,
      credits: user.credits,
      status: user.status,
      role: user.role,
      address: user.address,
      isEmailVerified: user.isEmailVerified,
      authProvider: user.authProvider,
      isActive: user.isActive,
      isBlocked: user.isBlocked,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export default new GoogleAuthService();