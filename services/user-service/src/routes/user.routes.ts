import express, {type Router} from "express";
import UserController from "@/controllers/user.controller.js";
import authMiddleware from "@/middlewares/authMiddleware.js";
import {limiter} from "@zemrev/config";

const router: Router = express.Router();

router.use(limiter);
router.use(authMiddleware.whoami);
router.use(authMiddleware.registered);

router.get("/profile", UserController.getProfile);

router.patch("/update-password", UserController.updatePassword);

router.patch("/update-address", UserController.updateAddress);

router.patch("/update-full-name", UserController.updateFullName);

router.get("/get-user-by-id/:id", authMiddleware.admin, UserController.getUserById);


export default router;