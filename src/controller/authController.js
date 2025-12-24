import mongoose from "mongoose";
import OTP from "../models/otpModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import {
  sendForgotPasswordMail,
  sendOtpMail,
} from "../service/emailService.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { createOTP } from "../utils/OtherUtils.js";
import {
  loginSchema,
  registerSchema,
  otpSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginWithGoogleSchema,
  ChangePasswordSchema,
} from "../validators/authSchema.js";
import Directory from "../models/directoryModel.js";
import envConfig from "../config/env.js";
import ForgotPasswordToken from "../models/forgotPasswordTokenModel.js";
import { verifyIdToken } from "../service/googleAuthService.js";

export const Login = asyncHandler(async (req, res) => {
  const { success, data } = loginSchema.safeParse(req.body);
  if (!success) throw new ApiError(400, "Invalid Credentials");

  const { email, password } = data;

  const existUser = await User.findOne({ email });
  if (!existUser) throw new ApiError(400, "Invalid Credentials");

  const isPasswordValid = await existUser.comparePassword(password);
  if (!isPasswordValid) throw new ApiError(400, "Invalid Credentials");

  // ✅ Limit to 2 sessions per user
  const existingSessions = await Session.find({ userId: existUser._id })
    .sort({ createdAt: 1 }) // Oldest first
    .select("_id");

  if (existingSessions.length >= 2) {
    // Delete oldest session
    await Session.deleteOne({ _id: existingSessions[0]._id });
  }

  // ✅ Create new session (simple!)
  const newSession = await Session.create({
    userId: existUser._id,
  });

  const sessionExpiryTime = 7 * 24 * 60 * 60 * 1000; // 7 days

  res.cookie("sid", newSession._id.toString(), {
    httpOnly: true,
    signed: true,
    sameSite: envConfig.NODE_ENV === "production" ? "none" : "lax",
    secure: envConfig.NODE_ENV === "production",
    maxAge: sessionExpiryTime,
  });

  const userData = {
    _id: existUser._id,
    name: existUser.name,
    email: existUser.email,
    picture: existUser.picture,
    role: existUser.role,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, userData, "User Login Successfully"));
});

export const Register = asyncHandler(async (req, res) => {
  const { success, error, data } = registerSchema.safeParse(req.body);

  if (!success || !data) throw new ApiError(400, error.message);

  const { name, email, password, otp } = data;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Verify OTP
  const otpRecord = await OTP.findOne({ email, otp });
  if (!otpRecord) throw new ApiError(400, "Invalid or Expired OTP!");

  const session = await mongoose.startSession();
  let newUser;

  try {
    await session.withTransaction(async () => {
      const rootDirId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      // Create user (password should be hashed by pre-save middleware)
      const createdUsers = await User.create(
        [
          {
            _id: userId,
            name,
            email,
            password,
            rootDirId,
          },
        ],
        { session },
      );

      newUser = createdUsers[0];

      // Create root directory
      await Directory.create(
        [
          {
            _id: rootDirId,
            userId: newUser._id,
            name: `root-${email}`,
            parentDirId: null, // Explicitly set null
          },
        ],
        { session },
      );
    });

    // Delete OTP after successful transaction
    await OTP.deleteOne({ _id: otpRecord._id });

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { email: newUser.email },
          "User Registered Successfully",
        ),
      );
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await session.endSession();
  }
});

export const Logout = asyncHandler(async (req, res) => {
  const { success, data, error } = logoutSchema.safeParse(req.body);
  if (!success) {
    throw new ApiError(400, error.message);
  }

  if (data.all) {
    // delete from all device
    await Session.deleteMany({ userId: req.user._id });
  } else {
    await Session.findByIdAndDelete(req.sessionId);
  }

  res.cookie("sid", "");
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        data.all ? "User Logout from all device" : "User Logout Successfully",
      ),
    );
});

export const ChangePassword = asyncHandler(async (req, res) => {
  const { success, data, error } = ChangePasswordSchema.safeParse(req.body);

  if (!success || error) throw new ApiError(401, error.message, error);

  const { newPassword } = data;

  const user = await User.findById(req.user._id).select("password");

  user.password = newPassword;

  await user.save();
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Change Password successfully"));
});

export const ForgotPassword = asyncHandler(async (req, res) => {
  const { success, error, data } = forgotPasswordSchema.safeParse(req.body);
  console.log(req.body);
  if (!success || !data) throw new ApiError(400, error.message);

  const { email } = data;

  const user = await User.findOne({ email });
  if (!user) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          "If this email exists, a reset link has been sent",
        ),
      );
  }

  await ForgotPasswordToken.deleteMany({
    userId: user._id,
    isUsed: false,
  });

  const resetToken = crypto.randomBytes(32).toString("hex");

  const tokenHash = ForgotPasswordToken.hashToken(resetToken);

  const expiresAt = new Date(Date.now() + 60 * 60 * 250); // 1 hour

  await ForgotPasswordToken.create({
    userId: user._id,
    email: user.email,
    tokenHash,
    expiresAt,
  });

  const resetUrl = `${envConfig.FRONTEND_URL}/reset-password/${resetToken}`;

  // Or for testing locally:
  // const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;

  await sendForgotPasswordMail(user.email, resetUrl, user.name);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Password reset link has been sent to your email",
      ),
    );
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

export const ResetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params; // Get token from URL
  const { success, error, data } = resetPasswordSchema.safeParse(req.body);

  if (!success || !data) throw new ApiError(400, error.message);

  const { password } = data;

  const tokenHash = ForgotPasswordToken.hashToken(token);

  const tokenRecord = await ForgotPasswordToken.findOne({
    tokenHash,
    isUsed: false,
    expiresAt: { $gt: new Date() }, // Not expired
  });

  if (!tokenRecord) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await User.updateOne(
        { _id: user._id },
        { password: password },
        { session },
      );

      // Mark token as used
      await ForgotPasswordToken.updateOne(
        { _id: tokenRecord._id },
        { isUsed: true },
        { session },
      );

      await Session.deleteMany({ userId: user._id }, { session });
    });
  } finally {
    await session.endSession();
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        "Password reset successful. Please login with your new password.",
      ),
    );
});

export const logineWithGoogle = asyncHandler(async (req, res) => {
  const { success, data, error } = loginWithGoogleSchema.safeParse(req.body);

  if (!success || error) throw new ApiError(400, error.message);
  const { email, name, picture } = await verifyIdToken(data.tokenId);

  const existUser = await User.findOne({ email });

  if (existUser) {
    // retrun response with creating session id with cookies
    const existingSessions = await Session.find({ userId: existUser._id })
      .sort({ createdAt: 1 }) // Oldest first
      .select("_id");
    if (existingSessions.length >= 2) {
      await Session.deleteOne({ _id: existingSessions[0]._id });
    }

    const newSession = await Session.create({
      userId: existUser._id,
    });

    const sessionExpiryTime = 7 * 24 * 60 * 60 * 1000; // 7 days

    res.cookie("sid", newSession._id.toString(), {
      httpOnly: true,
      signed: true,
      sameSite: envConfig.NODE_ENV === "production" ? "none" : "lax",
      secure: envConfig.NODE_ENV === "production",
      maxAge: sessionExpiryTime,
    });

    const userData = {
      _id: existUser._id,
      name: existUser.name,
      email: existUser.email,
      picture: existUser.picture,
      role: existUser.role,
    };
    return res
      .status(200)
      .json(new ApiResponse(200, userData, "User login successfully"));
  }

  const session = await mongoose.startSession();
  let newUser;
  let accessSessionId;

  try {
    await session.withTransaction(async () => {
      const rootDirId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      // Create user (password should be hashed by pre-save middleware)
      const createdUsers = await User.create(
        [
          {
            _id: userId,
            name,
            email,
            picture,
            rootDirId,
          },
        ],
        { session },
      );

      newUser = createdUsers[0];

      // Create root directory
      await Directory.create(
        [
          {
            _id: rootDirId,
            userId: newUser._id,
            name: `root-${email}`,
            parentDirId: null, // Explicitly set null
          },
        ],
        { session },
      );

      await Directory.create({
        userId: newUser._id,
        name: `My Folder`,
        parentDirId: rootDirId,
      });

      const accessSession = await Session.create({ userId: newUser._id });
      accessSessionId = accessSession._id;
    });
  } catch (error) {
    console.log(error);
    throw error;
  } finally {
    await session.endSession();
  }

  const sessionExpiryTime = 7 * 24 * 60 * 60 * 1000; // 7 days

  res.cookie("sid", accessSessionId.toString(), {
    httpOnly: true,
    signed: true,
    sameSite: envConfig.NODE_ENV === "production" ? "none" : "lax",
    secure: envConfig.NODE_ENV === "production",
    maxAge: sessionExpiryTime,
  });

  const userData = {
    _id: newUser._id,
    name: newUser.name,
    email: newUser.email,
    picture: newUser.picture,
    role: newUser.role,
  };
  return res
    .status(200)
    .json(new ApiResponse(200, userData, "User login successfully"));
});
