import { Router } from "express";
import {
  ChangePassword,
  ForgotPassword,
  GenerateOTP,
  Login,
  Logout,
  Register,
  ResetPassword,
} from "../controller/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", Login);
router.post("/register", Register);
router.post("/forgot-password", ForgotPassword);
router.post("/change-password", ChangePassword);
router.get("/reset-password/:token", ResetPassword);
router.post("/logout", authenticate, Logout);
router.post("/send-otp", GenerateOTP);

export default router;
