import envConfig from "../config/env.js";
import File from "../models/fileModel.js";
import Session from "../models/sessionModel.js";
import User from "../models/userModel.js";
import { invalidateCloudFront } from "../service/cloudfrontService.js";
import { generatePreSignUrl, headObject } from "../service/s3Service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import {
  DeleteUserSessionsSchema,
  UpdateProfileNameSchema,
  UpdateProfilePicSchema,
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
    new ApiResponse(
      200,
      {
        users,
        pagination: {
          currentPage: page,
          totalPages,
          totalUsers,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      "Users found successfully",
    ),
  );
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userFiles = await File.find({ userId: user._id });
  const usedStorageInBytes = userFiles.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  const responseData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    picture: user.picture,
    role: user.role,
    rootDirId: user.rootDirId,
    maxStorageInBytes: user.maxStorageInBytes,
    usedStorageInBytes,
    deleted: user.deleted,
  };
  res
    .status(200)
    .json(
      new ApiResponse(200, responseData, "Current user retrieved successfully"),
    );
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
    new ApiResponse(
      200,
      {
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
      },
      "Users search completed successfully",
    ),
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

  res.status(200).json(new ApiResponse(200, user, "User deleted successfully"));
});

export const DeleteUserSessions = asyncHandler(async (req, res) => {
  const { success, data, error } = DeleteUserSessionsSchema.safeParse(req.body);

  if (!success || !data) {
    throw new ApiError(400, error.message || "Please provide a valid user ID");
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
    new ApiResponse(
      200,
      {
        deletedCount: result.deletedCount,
        userId,
      },
      "User sessions deleted successfully",
    ),
  );
});

export const UpdateProfilePic = asyncHandler(async (req, res) => {
  const { success, data, error } = UpdateProfilePicSchema.safeParse(req.body);

  if (!success || error) throw new ApiError(error.issues[0].message);

  const { extension } = data;
  // generate presigned Url
  const uploadUrl = await generatePreSignUrl({
    key: `cdn/public/users/${req.user._id}.webp`,
    contentType: extension,
    expiresIn: 300,
  });
  res
    .status(200)
    .json(
      new ApiResponse(200, { uploadUrl }, "Get presigned url successfully"),
    );
});

export const ConformationProfilePicUploaded = asyncHandler(async (req, res) => {
  const result = await headObject({
    key: `cdn/public/users/${req.user._id}.webp`,
  });

  if (!result) throw new ApiError(400, "Object not found");

  // check is user profilePic already `${envConfig.CLOUDFRONT_DOMAIN}/public/users/${req.user._id}.webp`
  // then we don't need to update that in our data base because it is always constant
  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      picture: `${envConfig.CLOUDFRONT_DOMAIN}/public/users/${req.user._id}.webp`,
    },
  );

  await invalidateCloudFront([`/cdn/public/users/${req.user._id}.webp`]);

  res
    .status(200)
    .json(
      new ApiResponse(200, { userId: user._id, profilePicUrl: user.picture }),
    );
});
export const UpdateProfileName = asyncHandler(async (req, res) => {
  const { success, data, error } = UpdateProfileNameSchema.safeParse(req.body);
  if (!success || error) throw new ApiError(401, error.message);

  const { name } = data;

  await User.findOneAndUpdate(
    { _id: req.user._id },
    {
      name,
    },
  );
  res
    .status(200)
    .json(new ApiResponse(200, null, "User name updated successfully"));
});
