import express , {type Router} from "express";
import PaymentController from "@/controllers/payment.controller.js";
import authMiddleware from "@/middlewares/authMiddleware.js";
import { limiter } from "@zemrev/config";

const router: Router = express.Router();

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentController.webhook
);

router.use(limiter);
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

router.post("/buy-credits", PaymentController.createCheckout);
router.get("/verify", PaymentController.verifyPayment);
router.get("/billing-portal", PaymentController.billingPortal);
router.get("/history", PaymentController.history);
router.get("/total-spent", PaymentController.totalSpent);

export default router;