import jwt from "jsonwebtoken";
import crypto from "crypto";
import AppError from "./appError.js";

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

class JWTService {
  private readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET!;
  private readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly ACCESS_TOKEN_EXPIRY = "15m";
  private readonly REFRESH_TOKEN_EXPIRY = "7d";

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.ACCESS_TOKEN_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: "zemrev",
      audience: "zemrev-users",
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.REFRESH_TOKEN_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: "zemrev",
      audience: "zemrev-users",
    });
  }

  generateTokenPair(payload: TokenPayload): TokenResponse {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: "zemrev",
        audience: "zemrev-users",
      }) as TokenPayload;
    } catch (error: any) {
      if (error.name === "TokenExpiredError")
        throw new AppError("Access token expired", 401);
      if (error.name === "JsonWebTokenError")
        throw new AppError("Invalid access token", 401);
      throw new AppError("Token verification failed", 401);
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: "zemrev",
        audience: "zemrev-users",
      }) as TokenPayload;
    } catch (error: any) {
      if (error.name === "TokenExpiredError")
        throw new AppError("Refresh token expired. Please login again.", 401);
      if (error.name === "JsonWebTokenError")
        throw new AppError("Invalid refresh token", 401);
      throw new AppError("Token verification failed", 401);
    }
  }

  generateEmailVerificationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  generateSuperKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}

export default new JWTService();