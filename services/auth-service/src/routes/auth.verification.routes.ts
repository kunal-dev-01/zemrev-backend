import express, { type Router } from "express";
import AuthVerificationController from "@/controllers/auth.verification.controller.js";
import authMiddleware from "@/middlewares/authMiddleware.js";
import { authLimiter } from "@zemrev/config";

const router: Router = express.Router();

router.get(
  "/verify-email/:token",
  authLimiter,
  AuthVerificationController.verifyEmail
);

router.post(
  "/resend-verification-email",
  authLimiter,
  AuthVerificationController.resendVerificationEmail
);

router.post(
  "/forgot-password",
  authLimiter,
  AuthVerificationController.forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  AuthVerificationController.resetPassword
);

// PROTECTED ROUTES
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

// 2FA ROUTES
router.post("/2fa/setup", authLimiter, AuthVerificationController.setup2FA);
router.post("/2fa/enable", authLimiter, AuthVerificationController.enable2FA);
router.post("/2fa/disable", authLimiter, AuthVerificationController.disable2FA);
router.post(
  "/2fa/regenerate-backup-codes",
  authLimiter,
  AuthVerificationController.regenerateBackupCodes
);

export default router;
