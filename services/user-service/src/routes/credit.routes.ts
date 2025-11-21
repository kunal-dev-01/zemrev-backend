import express from "express";
import CreditController from "../controllers/credit.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests",
});

router.use(limiter);

router.get(
  "/status",
  authMiddleware.identifyUser,
  authMiddleware.requireAnyAuth,
  CreditController.getStatus
);

router.post(
  "/refund",
  authMiddleware.identifyUser,
  authMiddleware.requireAdmin,
  CreditController.refundCredits
);

// INTERNAL ROUTE - Deduct credits (called by tool-service)
router.post(
  "/deduct",
  authMiddleware.verifyServiceToken,
  async (req, res) => {
    // Handled by middleware in tool-service
    res.status(200).json({ status: "success" });
  }
);

export default router;