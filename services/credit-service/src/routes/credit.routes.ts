import express, { type Router } from "express";
import CreditController from "@/controllers/credit.controller.js";
import authMiddleware from "@/middlewares/authMiddleware.js";
import creditMiddleware from "@/middlewares/creditMiddleware.js";
import { limiter } from "@zemrev/config";

const router: Router = express.Router();

router.use(limiter);
router.use(authMiddleware.whoami);
router.use(creditMiddleware.checkBlocked);

// Public routes (guest or registered)
router.get("/status", CreditController.status);

// Admin routes
router.post("/refund", authMiddleware.admin, CreditController.refund);
router.get("/stats", authMiddleware.admin, CreditController.stats);

// Internal service route
router.post(
  "/internal/deduct",
  authMiddleware.service,
  async (req, res) => {
    res.status(200).json({ status: "success" });
  }
);

export default router;