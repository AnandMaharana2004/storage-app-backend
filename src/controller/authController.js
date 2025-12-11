import OTP from "../models/otpModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { sendOtpMail } from "../service/emailService.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { createOTP } from "../utils/OtherUtils.js";
import {
  loginSchema,
  registerSchema,
  otpSchema,
} from "../validators/authSchema.js";

export const Login = asyncHandler(async (req, res) => {
  const { success, data } = loginSchema.safeParse(req.body);
  if (!success) throw new ApiError(400, "Invalid Credentials");

  const { email, password } = data;

  const existUser = await User.findOne({ email });
  if (!existUser) throw new ApiError(400, "Invalid Credentials");

  const isPasswordValid = await existUser.comparePassword(password);

  if (!isPasswordValid) throw new ApiError(400, "Invalid Credentials");

  // session check and delete if it > 2 delete first one

  const existSession = await Session.find({ _id: existUser._id });

  if (existSession.length > 2) {
    // we need to delete the first one
  }

  // create new session
  const newSession = await Session.create({
    userId: existUser._id,
  });

  const sessionExpiryTime = 60 * 1000 * 60 * 24 * 7;

  res.cookie("sid", newSession._id, {
    httpOnly: true,
    signed: true,
    sameSite: "none",
    secure: true,
    maxAge: sessionExpiryTime,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, existUser.email, "User Login Successfully"));
});

export const Register = asyncHandler(async (req, res) => {
  const { success, error, data } = registerSchema.safeParse(req.body);

  if (!success || !data) throw new ApiError(400, error.message);

  const { name, email, password, otp } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  const otpRecord = await OTP.findOne(email, otp);

  if (!otpRecord) throw new ApiError(400, "Invalid Invalid or Expired OTP!");

  const newUser = await User.create({
    name,
    email,
    password, // Ensure your User model pre-save hook handles hashing
  });

  await OTP.deleteOne({
    _id: otpRecord._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newUser.email, "User Registered Successfully"));
});

export const Logout = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Logout Under Construction"));
});

export const ChangePassword = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Change Password Under Construction"));
});

export const ForgotPassword = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Forgot pasasword Under Construction"));
});

export const GenerateOTP = asyncHandler(async (req, res) => {
  const { success, data } = otpSchema.safeParse(req.body);

  if (!success || !data)
    throw new ApiError(400, "Missing required field: email");

  const { email } = data;

  const existOTPRecord = await OTP.findOne({ email });

  if (!existOTPRecord) {
    const otp = createOTP(4);
    const newOTPRecord = await OTP.create({
      email,
      otp,
    });
    await sendOtpMail(newOTPRecord.email, newOTPRecord.otp);
    return res
      .status(200)
      .json(
        new ApiResponse(200, newOTPRecord.email, "OTP generate successfully"),
      );
  }

  const otp = createOTP(4);
  existOTPRecord.otp = otp;
  await existOTPRecord.save();

  await sendOtpMail(existOTPRecord.email, existOTPRecord.otp);

  return res
    .status(200)
    .json(
      new ApiResponse(200, existOTPRecord.email, "OTP generate successfully"),
    );
});

export const VerifyForgotPasswordURL = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(
      new ApiResponse(200, null, "Verify Forgot Password URL Under Process"),
    );
});
