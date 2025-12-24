import { Router } from "express";
import {
  ChangePassword,
  ForgotPassword,
  GenerateOTP,
  Login,
  logineWithGoogle,
  Logout,
  Register,
  ResetPassword,
} from "../controller/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", Login);
router.post("/register", Register);
router.post("/forgot-password", ForgotPassword);
router.post("/change-password", authenticate, ChangePassword);
router.get("/reset-password/:token", ResetPassword);
router.post("/logout", authenticate, Logout);
router.post("/send-otp", GenerateOTP);

router.post("/google/callback", logineWithGoogle);

export default router;
