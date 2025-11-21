import { OAuth2Client } from "google-auth-library";
import axios from "axios";
import env from '@/config/env.config.js';
import { User } from "@zemrev/models";
import { AppError } from '@zemrev/utils';
import redisService from "@/redis/redis.js";
import jwtService from "@/utils/jwt.js";

const GOOGLE_AUTH_BASE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
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

  getGoogleAuthURL(): string {
    const params = new URLSearchParams({
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      client_id: env.GOOGLE_CLIENT_ID,
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: GOOGLE_SCOPES.join(" "),
    });
    return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<any> {
    try {
      const { tokens } = await this.client.getToken(code);
      if (!tokens.access_token) {
        throw new AppError("Failed to obtain Google access token", 401);
      }

      this.client.setCredentials(tokens);

      const googleUser = await this.getGoogleUserInfo(tokens.access_token);

      const user = await User.findOrCreateGoogleUser({
        googleId: googleUser.id as string,
        email: googleUser.email as string,
        name: googleUser.name as string,
        avatar: googleUser.picture as string,
      });

      const jwtTokens = jwtService.generateTokenPair({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      await redisService.storeRefreshToken(
        user._id.toString(),
        jwtTokens.refreshToken
      );

      return {
        user: {
          _id: user._id.toString(),
          fullName: user.fullName,
          email: user.email,
          plan: user.plan,
          planType: user.planType,
          planActive: user.planActive,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          authProvider: user.authProvider,
          credits: user.credits,
          creditsUsed: user.creditsUsed,
          nextCreditReset: user.nextCreditReset,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          twoFactorEnabled: user.twoFactorEnabled,
          subscriptionStatus: user.subscriptionStatus,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
      };
    } catch (err) {
      console.error("❌ Google OAuth Error:", err);
      if (err instanceof AppError) throw err;
      throw new AppError("Google authentication failed", 401);
    }
  }

  private async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const { data } = await axios.get<GoogleUserInfo>(GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!data?.id || !data?.email) {
        throw new AppError("Invalid Google user data", 400);
      }

      return data;
    } catch (err) {
      console.error("❌ Failed to fetch Google user info:", err);
      throw new AppError("Failed to retrieve Google user information", 401);
    }
  }
}

export default new GoogleAuthService();