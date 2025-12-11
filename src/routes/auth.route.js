import { Router } from "express";
import {
  ChangePassword,
  ForgotPassword,
  GenerateOTP,
  Login,
  Logout,
  Register,
  VerifyForgotPasswordURL,
} from "../controller/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/login", Login);
router.post("/register", Register);
router.post("/forgot-password", ForgotPassword);
router.post("/change-password", ChangePassword);
router.get("/verify-forgot-link:id", VerifyForgotPasswordURL);
router.post("/logout", authenticate, Logout);
router.post("/send-otp", GenerateOTP);

export default router;
