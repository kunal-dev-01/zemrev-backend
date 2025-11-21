import express, { type Router } from "express";
import AuthController from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router: Router = express.Router();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many attempts, please try again later",
  skipSuccessfulRequests: true,
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests, please try again later",
});

// PUBLIC ROUTES
router.post("/signup", authLimiter, AuthController.signup);
router.get("/verify-email/:token", authLimiter, AuthController.verifyEmail);
router.post("/resend-verification-email", authLimiter, AuthController.resendVerificationEmail);
router.post("/login", generalLimiter, AuthController.login);
router.post("/verify-2fa", authLimiter, AuthController.verify2FA);
router.post("/refresh-token", authLimiter, AuthController.refreshToken);
router.post("/forgot-password", authLimiter, AuthController.forgotPassword);
router.post("/reset-password", authLimiter, AuthController.resetPassword);

// Google OAuth
router.get("/google", generalLimiter, AuthController.googleAuth);
router.get("/google/callback", authLimiter, AuthController.googleCallback);

// PROTECTED ROUTES
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

router.post("/logout", authLimiter, AuthController.logout);
router.post("/logout-all", authLimiter, AuthController.logoutAll);

// 2FA ROUTES
router.post("/2fa/setup", authLimiter, AuthController.setup2FA);
router.post("/2fa/enable", authLimiter, AuthController.enable2FA);
router.post("/2fa/disable", authLimiter, AuthController.disable2FA);
router.get("/2fa/status", authLimiter, AuthController.get2FAStatus);
router.post("/2fa/regenerate-backup-codes", authLimiter, AuthController.regenerateBackupCodes);

export default router;