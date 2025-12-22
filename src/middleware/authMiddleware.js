import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const sessionId = req.signedCookies.sid;

  if (!sessionId) {
    throw new ApiError(401, "Unauthorized - No session found");
  }

  const session = await Session.findById(sessionId).lean();
  if (!session) {
    throw new ApiError(401, "Unauthorized - Invalid session");
  }

  const user = await User.findById(session.userId)
    .select("-password -__v")
    .lean();

  if (!user) {
    throw new ApiError(401, "Unauthorized - User not found");
  }

  req.user = user;
  req.sessionId = session._id;

  next();
});

export const isAdmin = (req, res, next) => {
  if (req.user.role === "Admin") return next();
  res.status(403).json({ error: "You can not delete users" });
};
