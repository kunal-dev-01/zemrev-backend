import { Request, Response } from "express";
import AuthService from "@/services/auth.service.js"; 
import googleService from "@/services/googleAuth.service.js";
import { catchAsync, AppError } from "@zemrev/utils";
import env from "@/config/env.config.js";

class AuthController {
  private static readonly COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  private static setRefreshCookie(res: Response, token: string) {
    res.cookie("refreshToken", token, this.COOKIE_OPTIONS);
  }

  /**---------------------------
   * ✅ SIGNUP (With fingerprint validation)
   * ---------------------------*/
  static signup = catchAsync(async (req: Request, res: Response) => {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      throw new AppError("Missing required fields", 400);
    }

    const fingerprint = req.headers["x-fingerprint"] as string;

    const result = await AuthService.signup({
      fullName,
      email,
      password,
      fingerprint,
    });

    this.setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      status: "success",
      message: "Account created. Complete payment to activate your account.",
      data: {
        user: result.user,
        accessToken: result.accessToken
      },
    });
  });

  /**---------------------------
   * ✅ LOGIN
   * ---------------------------*/
  static login = catchAsync(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError("Email and password required", 400);

    const deviceInfo = req.headers["user-agent"] ?? "unknown";
    const result = await AuthService.login(email, password, deviceInfo);

    if (result.requires2FA) {
      res.status(200).json({
        status: "success",
        message: "2FA verification needed",
        data: { requires2FA: true, tempToken: result.tempToken },
      });
      return;
    }

    this.setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      status: "success",
      message: "Login successful",
      data: { user: result.user, accessToken: result.accessToken },
    });
  });

  /**---------------------------
   * ✅ VERIFY 2FA
   * ---------------------------*/
  static verify2FA = catchAsync(async (req: Request, res: Response) => {
    const { tempToken, totpCode, superKey, isBackupCode } = req.body;
    if (!tempToken || !totpCode) throw new AppError("Missing 2FA details", 400);

    const result = await AuthService.verify2FA(
      tempToken,
      totpCode,
      isBackupCode,
      superKey
    );

    this.setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      status: "success",
      message: "2FA verified",
      data: { user: result.user, accessToken: result.accessToken },
    });
  });

  /**---------------------------
   * ✅ GOOGLE AUTH (With fingerprint)
   * ---------------------------*/
  static googleAuth = catchAsync(async (req: Request, res: Response) => {
    const fingerprint = req.headers["x-fingerprint"] as string;
    const authUrl = googleService.getGoogleAuthURL(fingerprint);
    res.redirect(authUrl);
  });

  /**---------------------------
   * ✅ GOOGLE CALLBACK (With state validation)
   * ---------------------------*/
  static googleCallback = catchAsync(async (req: Request, res: Response) => {
    const { code, state } = req.query as any;
    
    if (!code) throw new AppError("Authorization code missing", 400);
    if (!state) throw new AppError("State token missing", 400);

    const fingerprint = req.headers["x-fingerprint"] as string | undefined;

    const result = await googleService.handleGoogleCallback(
      code, 
      state,
      fingerprint
    );

    this.setRefreshCookie(res, result.refreshToken);

    // ✅ REDIRECT WITH TOKEN
    const redirectUrl = `${env.CLIENT_URL}/auth/callback?token=${result.accessToken}`;

    res.redirect(redirectUrl);
  });

  /**---------------------------
   * ✅ REFRESH TOKEN
   * ---------------------------*/
  static refreshToken = catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) throw new AppError("Refresh token missing", 401);

    const newAccessToken = await AuthService.refreshAccessToken(refreshToken);

    res.status(200).json({
      status: "success",
      data: { accessToken: newAccessToken },
    });
  });

  /**---------------------------
   * ✅ LOGOUT
   * ---------------------------*/
  static logout = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const refreshToken = req.cookies.refreshToken;

    if (!userId || !refreshToken) throw new AppError("Invalid request", 400);

    await AuthService.logout(userId, refreshToken);
    res.clearCookie("refreshToken");

    res.status(200).json({ status: "success", message: "Logged out" });
  });

  static logoutAll = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    if (!userId) throw new AppError("Invalid request", 400);

    await AuthService.logoutAll(userId);
    res.clearCookie("refreshToken");

    res.status(200).json({ status: "success", message: "Logged out from all devices" });
  });
}

export default AuthController;