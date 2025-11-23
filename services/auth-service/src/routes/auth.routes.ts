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
router.post("/login", generalLimiter, AuthController.login);
router.post("/verify-2fa", authLimiter, AuthController.verify2FA);
router.post("/refresh-token", authLimiter, AuthController.refreshToken);

// Google OAuth
router.get("/google", generalLimiter, AuthController.googleAuth);
router.get("/google/callback", authLimiter, AuthController.googleCallback);

// PROTECTED ROUTES
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

router.post("/logout", authLimiter, AuthController.logout);
router.post("/logout-all", authLimiter, AuthController.logoutAll);

export default router;