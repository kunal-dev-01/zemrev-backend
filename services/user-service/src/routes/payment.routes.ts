import express from "express";
import PaymentController from "../controllers/payment.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests",
});

// Webhook (NO AUTH - Stripe calls this)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.webhook
);

router.use(limiter);
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

router.post("/create-checkout", PaymentController.createCheckout);
router.post("/buy-credits", PaymentController.buyCredits);
router.get("/verify", PaymentController.verifyPayment);
router.post("/cancel-subscription", PaymentController.cancelSubscription);
router.get("/billing-portal", PaymentController.getBillingPortal);
router.get("/history", PaymentController.getPaymentHistory);

export default router;