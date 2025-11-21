import express, {type Router} from "express";
import UserController from "../controllers/user.controller.js";
import authMiddleware from "../middlewares/authMiddleware.js";
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
router.put("/profile", UserController.updateProfile);
router.post("/change-password", UserController.changePassword);
router.delete("/account", UserController.deletAccount);

export default router;