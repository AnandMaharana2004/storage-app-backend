import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import {
  DeleteUserSessionsSchema,
  deleteUserSchema,
} from "../validators/userSchema.js";

export const AllUsers = asyncHandler(async (req, res) => {
  // Implement pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Find users that are not deleted
  const users = await User.find({ deleted: false })
    .select("-password")
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination metadata
  const totalUsers = await User.countDocuments({ deleted: false });
  const totalPages = Math.ceil(totalUsers / limit);

  res.status(200).json(
    new ApiResponse(200, "Users found successfully", {
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }),
  );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, "Current user retrieved successfully", user));
});

export const SearchUserByNameOrEmail = asyncHandler(async (req, res) => {
  // Get search query from query params
  const searchQuery = req.query.search || "";
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  if (!searchQuery.trim()) {
    throw new ApiError(400, "Search query is required");
  }

  // Search users by name or email using regex for partial matching
  const searchRegex = new RegExp(searchQuery, "i"); // Case-insensitive search

  const users = await User.find({
    deleted: false,
    $or: [{ name: searchRegex }, { email: searchRegex }],
  })
    .select("-password")
    .skip(skip)
    .limit(limit)
    .lean();

  // Get total count for pagination
  const totalUsers = await User.countDocuments({
    deleted: false,
    $or: [{ name: searchRegex }, { email: searchRegex }],
  });

  const totalPages = Math.ceil(totalUsers / limit);

  res.status(200).json(
    new ApiResponse(200, "Users search completed successfully", {
      users,
      searchQuery,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }),
  );
});

// TODO: We need to write extra logic for deleted user
export const DeleteUser = asyncHandler(async (req, res) => {
  if (req.user.role !== "Admin") {
    throw new ApiError(403, "Only admins can delete users");
  }

  const validationResult = deleteUserSchema.safeParse(req.body);

  if (!validationResult.success) {
    throw new ApiError(400, validationResult.error.errors[0].message);
  }

  const { userId } = validationResult.data;

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { deleted: true },
    { new: true },
  ).select("-password");

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  res.status(200).json(new ApiResponse(200, "User deleted successfully", user));
});

export const DeleteUserSessions = asyncHandler(async (req, res) => {
  const { success, data, error } = DeleteUserSessionsSchema.safeParse(req.body);

  if (!success || !data) {
    throw new ApiError(
      400,
      error?.errors[0]?.message || "Please provide a valid user ID",
    );
  }

  const { userId } = data;

  if (req.user.role !== "Admin" && req.user._id.toString() !== userId) {
    throw new ApiError(
      403,
      "You can only delete your own sessions or must be an admin",
    );
  }

  const userExists = await User.findById(userId);
  if (!userExists) {
    throw new ApiError(404, "User not found");
  }

  const result = await Session.deleteMany({ userId });

  res.status(200).json(
    new ApiResponse("User sessions deleted successfully", {
      deletedCount: result.deletedCount,
      userId,
    }),
  );
});
