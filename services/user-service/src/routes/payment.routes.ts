import express , {type Router} from "express";
import PaymentController from "../controllers/payment.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router: Router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests",
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.webhook
);

router.use(limiter);
router.use(authMiddleware.whoami);
router.use(authMiddleware.registered);

router.post("/buy-credits", PaymentController.createCheckout);
router.get("/verify", PaymentController.verifyPayment);
router.get("/billing-portal", PaymentController.billingPortal);
router.get("/history", PaymentController.history);
router.get("/total-spent", PaymentController.totalSpent);

export default router;