import express , {type Router} from "express";
import CreditController from "../controllers/credit.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router : Router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests",
});

router.use(limiter);
router.use(authMiddleware.whoami);

// Public routes (guest or registered)
router.get(
  "/status",
  authMiddleware.registered,
  CreditController.status
);

// Admin routes
router.post(
  "/refund",
  authMiddleware.admin,
  CreditController.refund
);

router.get(
  "/stats",
  authMiddleware.admin,
  CreditController.stats
);

// Internal service route (for tool-service to deduct credits)
router.post(
  "/internal/deduct",
  authMiddleware.service,
  async (req, res) => {
    // This is handled by creditMiddleware in tool-service
    res.status(200).json({ status: "success" });
  }
);

export default router;