import File from "../models/fileModel.js";
import envConfig from "../config/env.js";
import Share from "../models/shareModel.js";
import User from "../models/userModel.js";
import { getSignedCookieValues } from "../service/cloudfrontService.js";
// import { ensureShareKVSMapping } from "../service/kvsService.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { BlockShareSchema, shareSchema } from "../validators/shareSchema.js";
import { nanoid } from "nanoid";
import {
  deleteShareKVSMapping,
  ensureShareKVSMapping,
} from "../service/keyValuePairService.js";
import Directory from "../models/directoryModel.js";

export const ShareAssets = asyncHandler(async (req, res) => {
  const { success, data, error } = shareSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.issues[0].message);
  }

  const {
    assetsId, // file OR folder id
    visibility, // "private" | "public"
    expiryHours,
    sharedWithUserIds, // only for private
  } = data;

  const userId = req.user._id;

  // 1️⃣ Resolve asset (file OR folder)
  const file = await File.findOne({ _id: assetsId, userId });
  const folder = !file
    ? await Directory.findOne({ _id: assetsId, userId })
    : null;

  if (!file && !folder) {
    throw new ApiError(404, "Asset not found or access denied");
  }

  const resourceType = file ? "file" : "folder";
  const resource = file || folder;

  // 2️⃣ File-specific validations
  if (resourceType === "file" && resource.isUploading) {
    throw new ApiError(400, "Cannot share file while uploading");
  }

  // 3️⃣ Prevent duplicate active share
  const existingShare = await Share.findOne({
    resourceType,
    resourceId: resource._id,
    ownerId: userId,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });

  if (existingShare) {
    throw new ApiError(
      409,
      "An active share already exists. Please deactivate or delete it first.",
    );
  }

  // 4️⃣ Visibility validation
  let sharedWithUsers = null;

  if (visibility === "private") {
    if (!sharedWithUserIds?.length) {
      throw new ApiError(400, "Private share requires at least one user");
    }

    sharedWithUsers = await User.find(
      { _id: { $in: sharedWithUserIds } },
      { _id: 1, username: 1, email: 1, fullName: 1 },
    );

    if (sharedWithUsers.length !== sharedWithUserIds.length) {
      throw new ApiError(400, "Invalid user IDs provided");
    }
  } else if (visibility === "public") {
    if (sharedWithUserIds?.length) {
      throw new ApiError(400, "Public shares cannot have specific users");
    }
  } else {
    throw new ApiError(400, "Visibility must be 'private' or 'public'");
  }

  // 5️⃣ Generate shareId
  const shareId = nanoid(12);

  // 6️⃣ Expiry
  const expiresAt = expiryHours
    ? new Date(Date.now() + expiryHours * 60 * 60 * 1000)
    : null;

  // 7️⃣ Create share
  const share = await Share.create({
    shareId,
    resourceType,
    resourceId: resource._id,
    ownerId: userId,
    visibility,
    allowedUsers: visibility === "private" ? sharedWithUserIds : [],
    expiresAt,
    isActive: true,
  });

  // 8️⃣ Response
  const shareUrl = `${envConfig.FRONTEND_URL1}/share/${shareId}`;

  res.status(201).json(
    new ApiResponse(
      201,
      {
        shareUrl,
        shareId: share.shareId,
        resourceType,
        visibility,
        expiresAt,
        sharedWith:
          visibility === "private"
            ? sharedWithUsers.map((u) => ({
                id: u._id,
                username: u.username,
                email: u.email,
                fullName: u.fullName,
              }))
            : null,
      },
      visibility === "private"
        ? `${resourceType} shared privately`
        : `${resourceType} shared publicly`,
    ),
  );
});

/**
 * Block/Delete a share
 * DELETE /api/share/:shareId
 */
export const BlockShare = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const { success, data, error } = BlockShareSchema.safeParse(req.params);

  if (!success || error) throw new ApiError(400, error.issues[0].message);

  const shareId = data.shareId;

  const share = await Share.findOne({ shareId });

  if (!share) {
    throw new ApiError(404, "Share not found");
  }

  if (!share.ownerId.equals(userId)) {
    throw new ApiError(403, "You can only delete your own shares");
  }
  // TODO: here we have to delete the key value which are store inside the cloudfront keyvalueStore
  await deleteShareKVSMapping(shareId);
  await Share.deleteOne({ shareId });

  res
    .status(200)
    .json(new ApiResponse(200, { shareId }, "Share deleted successfully"));
});

/**
 * Access a privately shared file
 * GET /api/share/private/:shareId
 */
export const AccessSharedPrivate = asyncHandler(async (req, res) => {
  const { shareId } = req.params;
  const userId = req.user?._id;

  // 1️⃣ Fetch active private share
  const share = await Share.findOne({
    shareId,
    isActive: true,
    visibility: "private",
  });

  if (!share) {
    throw new ApiError(404, "Share not found or inactive");
  }

  // 2️⃣ Expiry check
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new ApiError(403, "Share has expired");
  }

  // 3️⃣ Auth required
  if (!userId) {
    throw new ApiError(401, "Login required to access private share");
  }

  // 4️⃣ Authorization check
  if (!share.allowedUsers.some((id) => id.equals(userId))) {
    throw new ApiError(403, "You do not have access to this resource");
  }

  // 5️⃣ Resolve resource (file OR folder)
  let resource;
  const resourceType = share.resourceType;

  if (resourceType === "file") {
    resource = await File.findById(share.resourceId);
    if (!resource) throw new ApiError(404, "File not found");
  } else if (resourceType === "folder") {
    resource = await Directory.findById(share.resourceId);
    if (!resource) throw new ApiError(404, "Folder not found");
  } else {
    throw new ApiError(400, "Invalid shared resource type");
  }

  // 6️⃣ Ensure KVS mapping exists
  await ensureShareKVSMapping({
    shareId,
    fileId: resource._id,
    ownerId: share.ownerId,
    fileName: resource.name,
  });

  // 7️⃣ Generate CloudFront signed cookies
  const policyPath = `/private/shares/${shareId}/*`;
  const cookies = getSignedCookieValues(policyPath);

  // 8️⃣ Set cookies (STRICT + correct path)
  cookies.forEach(({ name, value }) => {
    res.cookie(name, value, {
      path: "/private/shares", // 🔑 MUST match CloudFront path
      httpOnly: true,
      secure: envConfig.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 5 * 60 * 1000, // 5 minutes
    });
  });

  // 9️⃣ CDN URL
  const resourceUrl =
    resourceType === "file"
      ? `${envConfig.CLOUDFRONT_DOMAIN}/private/shares/${shareId}/${resource._id}`
      : `${envConfig.CLOUDFRONT_DOMAIN}/private/shares/${shareId}/`;

  // 🔟 Response
  res.status(200).json(
    new ApiResponse(
      200,
      {
        url: resourceUrl,
        resourceType,
        name: resource.name,
        expiresInMinutes: 5,
      },
      "Access granted",
    ),
  );
});

/**
 * Access a publicly shared file
 * GET /api/share/public/:shareId
 */
export const AccessSharedPublic = asyncHandler(async (req, res) => {
  const { shareId } = req.params;

  // 1️⃣ Fetch active share
  const share = await Share.findOne({
    shareId,
    isActive: true,
    visibility: "public",
  });

  if (!share) {
    throw new ApiError(404, "Share not found or inactive");
  }

  // 2️⃣ Expiry check
  if (share.expiresAt && share.expiresAt < new Date()) {
    throw new ApiError(403, "Share has expired");
  }

  // 3️⃣ Resolve resource (file OR folder)
  let resource;
  let resourceType = share.resourceType;

  if (resourceType === "file") {
    resource = await File.findById(share.resourceId);
    if (!resource) throw new ApiError(404, "File not found");
  } else if (resourceType === "folder") {
    resource = await Directory.findById(share.resourceId);
    if (!resource) throw new ApiError(404, "Folder not found");
  } else {
    throw new ApiError(400, "Invalid shared resource type");
  }

  // 4️⃣ Ensure KVS mapping exists
  await ensureShareKVSMapping({
    shareId,
    fileId: resource._id,
    ownerId: share.ownerId,
    fileName: resource.name,
  });

  // 5️⃣ Generate CloudFront signed cookies
  const policyPath = `/public/shares/${shareId}/*`;
  const cookies = getSignedCookieValues(policyPath);

  // 6️⃣ Set cookies (MUST match CloudFront path)
  cookies.forEach(({ name, value }) => {
    res.cookie(name, value, {
      path: "/public/shares", // 🔑 IMPORTANT
      httpOnly: true,
      secure: envConfig.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 5 * 60 * 1000, // 5 minutes
    });
  });

  // 7️⃣ CDN URL
  const resourceUrl =
    resourceType === "file"
      ? `${envConfig.CLOUDFRONT_DOMAIN}/public/shares/${shareId}/${resource._id}`
      : `${envConfig.CLOUDFRONT_DOMAIN}/public/shares/${shareId}/`;

  // 8️⃣ Owner info
  const owner = await User.findById(share.ownerId, "username");

  // 9️⃣ Response
  res.status(200).json(
    new ApiResponse(
      200,
      {
        url: resourceUrl,
        resourceType,
        name: resource.name,
        expiresInMinutes: 5,
        owner: {
          username: owner?.username,
        },
      },
      "Access granted",
    ),
  );
});

/**
 * Get share details (metadata only, no file access)
 * GET /api/share/details/:shareId
 */
export const GetShareDetails = asyncHandler(async (req, res) => {
  const { shareId } = req.params;
  const userId = req.user?._id || null;

  // 1️⃣ Fetch share
  const share = await Share.findOne({ shareId, isActive: true })
    .populate("ownerId", "username fullName")
    .populate("allowedUsers", "username email fullName");

  if (!share) {
    throw new ApiError(404, "Share not found or inactive");
  }

  // 2️⃣ Expiry check
  const isExpired = share.expiresAt && share.expiresAt < new Date();

  // 3️⃣ Check access for private shares
  let hasAccess = true;
  if (share.visibility === "private") {
    if (!userId) {
      hasAccess = false;
    } else {
      hasAccess = share.allowedUsers.some((user) => user._id.equals(userId));
    }
  }

  // 4️⃣ Fetch file metadata
  const file = await File.findById(
    share.resourceId,
    "name size mimeType createdAt",
  );

  // 5️⃣ Build response
  const responseData = {
    shareId: share.shareId,
    visibility: share.visibility,
    isExpired,
    expiresAt: share.expiresAt,
    hasAccess,
    owner: {
      username: share.ownerId.username,
      fullName: share.ownerId.fullName,
    },
    file: file
      ? {
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
        }
      : null,
    // Only show allowed users if the requester is the owner or has access
    sharedWith:
      share.visibility === "private" &&
      (hasAccess || share.ownerId._id.equals(userId))
        ? share.allowedUsers.map((user) => ({
            username: user.username,
            email: user.email,
            fullName: user.fullName,
          }))
        : null,
  };

  res
    .status(200)
    .json(new ApiResponse(200, responseData, "Share details retrieved"));
});

/**
 * Get all shares created by the current user
 * GET /api/share/my-shares
 */
export const GetMyShares = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Fetch all shares created by this user
  const shares = await Share.find({ ownerId: userId })
    .populate("resourceId", "name size mimeType")
    .populate("allowedUsers", "username email")
    .sort({ createdAt: -1 });

  const formattedShares = shares.map((share) => ({
    shareId: share.shareId,
    visibility: share.visibility,
    isActive: share.isActive,
    isExpired: share.expiresAt && share.expiresAt < new Date(),
    expiresAt: share.expiresAt,
    createdAt: share.createdAt,
    shareUrl: `${envConfig.FRONTEND_URL1}/share/${share.shareId}`,
    file: {
      name: share.resourceId.name,
      size: share.resourceId.size,
      mimeType: share.resourceId.mimeType,
    },
    sharedWith:
      share.visibility === "private"
        ? share.allowedUsers.map((user) => ({
            username: user.username,
            email: user.email,
          }))
        : null,
  }));

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { shares: formattedShares, total: formattedShares.length },
        "Shares retrieved successfully",
      ),
    );
});
