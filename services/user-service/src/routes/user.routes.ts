import express, {type Router} from "express";
import UserController from "@/controllers/user.controller.js";
import authMiddleware from "@/middlewares/authMiddleware.js";
import rateLimit from "express-rate-limit";

const router: Router = express.Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many requests",
});

router.use(limiter);
router.use(authMiddleware.identifyUser);
router.use(authMiddleware.requireRegisteredUser);

router.get("/profile", UserController.getProfile);

router.patch("/update-password", UserController.updatePassword);

router.patch("/update-phone-number", UserController.updatePhoneNumber);

router.patch("/update-address", UserController.updateAddress);

router.patch("/update-full-name", UserController.updateFullName);

router.get("/get-user-by-id/:id", authMiddleware.requireAdmin, UserController.getUserById);


export default router;