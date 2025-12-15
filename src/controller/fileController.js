import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import File from "../models/fileModel.js";
import Directory from "../models/directoryModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";
import {
  generatePreSignUrl,
  deleteObject,
  headObject,
} from "../service/s3Service.js";
import {
  generateSignedUrl,
  invalidateCloudFront,
} from "../service/cloudfrontService.js";
import envConfig from "../config/env.js";
import {
  requestUploadSchema,
  completeUploadSchema,
  getFileSchema,
  renameFileSchema,
  deleteFileSchema,
  shareFileSchema,
  moveFileSchema,
  getFilesInDirectorySchema,
} from "../validators/fileSchema.js";

function getMimeType(extension) {
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
  };

  return mimeTypes[extension.toLowerCase()] || "application/octet-stream";
}

function generateS3Key(userId, fileId, extension) {
  return `users/${userId}/files/${fileId}${extension}`;
}

async function updateDirectorySizes(directoryId) {
  if (!directoryId) return;

  const directory = await Directory.findById(directoryId);
  if (!directory) return;

  // Calculate total size of files in this directory
  const files = await File.find({ parentDirId: directoryId });
  let totalSize = files.reduce((sum, file) => sum + file.size, 0);

  // Add sizes of subdirectories
  const subdirectories = await Directory.find({ parentDirId: directoryId });
  for (const subdir of subdirectories) {
    totalSize += subdir.size;
  }

  // Update directory size
  await Directory.findByIdAndUpdate(directoryId, { size: totalSize });

  // Recursively update parent
  if (directory.parentDirId) {
    await updateDirectorySizes(directory.parentDirId);
  }
}

function generateDownloadUrl(s3Key, expiresInMinutes = 60) {
  return generateSignedUrl(s3Key, expiresInMinutes);
}

export const RequestUploadUrl = asyncHandler(async (req, res) => {
  const { success, data, error } = requestUploadSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { name, size, extension, parentDirId } = data;
  const userId = req.user._id;

  // Verify parent directory exists and belongs to user
  if (parentDirId) {
    const parentDir = await Directory.findOne({
      _id: parentDirId,
      userId,
    });

    if (!parentDir) {
      throw new ApiError(404, "Parent directory not found or access denied");
    }
  }

  // Check user's storage quota
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Calculate current storage usage
  const userFiles = await File.find({ userId });
  const currentUsage = userFiles.reduce((sum, file) => sum + file.size, 0);

  if (currentUsage + size > user.maxStorageInBytes) {
    throw new ApiError(
      413,
      `Storage limit exceeded. You have ${Math.round(
        (user.maxStorageInBytes - currentUsage) / (1024 * 1024),
      )}MB remaining.`,
    );
  }

  // Create unique file ID and S3 key
  const fileId = new mongoose.Types.ObjectId();
  const s3Key = generateS3Key(userId, fileId, extension);

  // Create file record in database
  const file = await File.create({
    _id: fileId,
    name,
    size,
    extension,
    userId,
    isUploading: true,
    parentDirId: parentDirId || null,
  });

  // Generate presigned URL for S3 upload
  const uploadUrl = await generatePreSignUrl({
    bucketName: envConfig.AWS_BUCKET_NAME,
    key: s3Key,
    contentType: getMimeType(extension),
    expiresIn: 900, // 15 minutes
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        uploadUrl,
        fileId: file._id,
        s3Key,
        expiresIn: 900,
      },
      "Upload URL generated successfully",
    ),
  );
});

export const CompleteUpload = asyncHandler(async (req, res) => {
  const { success, data, error } = completeUploadSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId } = data;
  const userId = req.user._id;

  const file = await File.findOne({
    _id: fileId,
    userId,
  });

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  if (!file.isUploading) {
    throw new ApiError(400, "File upload already completed");
  }

  const s3Key = generateS3Key(userId, fileId, file.extension);

  try {
    await headObject({
      bucketName: envConfig.AWS_BUCKET_NAME,
      key: s3Key,
    });
  } catch (error) {
    // Cleanup database record if S3 upload failed
    console.log(error);
    await File.findByIdAndDelete(fileId);
    throw new ApiError(400, "File not found in S3. Upload may have failed.");
  }

  file.isUploading = false;
  await file.save();

  if (file.parentDirId) {
    await updateDirectorySizes(file.parentDirId);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          _id: file._id,
          name: file.name,
          size: file.size,
          extension: file.extension,
          parentDirId: file.parentDirId,
          createdAt: file.createdAt,
        },
      },
      "File uploaded successfully",
    ),
  );
});

export const GetFile = asyncHandler(async (req, res) => {
  const { success, data, error } = getFileSchema.safeParse(req.params);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId } = data;
  const userId = req.user._id;

  const file = await File.findOne({
    _id: fileId,
    userId,
  });

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  if (file.isUploading) {
    throw new ApiError(400, "File is still uploading");
  }

  const s3Key = generateS3Key(userId, fileId, file.extension);
  const downloadUrl = generateDownloadUrl(s3Key, 60); // 60 minutes expiry

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          _id: file._id,
          name: file.name,
          size: file.size,
          extension: file.extension,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
        downloadUrl,
        expiresIn: 3600, // 60 minutes in seconds
      },
      "File retrieved successfully",
    ),
  );
});

export const RenameFile = asyncHandler(async (req, res) => {
  const { success, data, error } = renameFileSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId, newName } = data;
  const userId = req.user._id;

  // Find file and verify ownership
  const file = await File.findOne({
    _id: fileId,
    userId,
  });

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  // Check if file with same name exists in same directory
  const existingFile = await File.findOne({
    name: newName,
    userId,
    parentDirId: file.parentDirId,
    _id: { $ne: fileId },
  });

  if (existingFile) {
    throw new ApiError(
      409,
      "A file with this name already exists in this directory",
    );
  }

  // Update file name
  file.name = newName;
  await file.save();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          _id: file._id,
          name: file.name,
          size: file.size,
          extension: file.extension,
          parentDirId: file.parentDirId,
          updatedAt: file.updatedAt,
        },
      },
      "File renamed successfully",
    ),
  );
});

export const DeleteFile = asyncHandler(async (req, res) => {
  const { success, data, error } = deleteFileSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId } = data;
  const userId = req.user._id;

  // Find file and verify ownership
  const file = await File.findOne({
    _id: fileId,
    userId,
  });

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  const parentDirId = file.parentDirId;
  const s3Key = generateS3Key(userId, fileId, file.extension);

  // Delete from S3
  try {
    await deleteObject({
      bucketName: envConfig.AWS_BUCKET_NAME,
      key: s3Key,
    });

    // Invalidate CloudFront cache for the deleted file
    await invalidateCloudFront([`/${s3Key}`]);
  } catch (s3Error) {
    console.error("S3/CloudFront deletion error:", s3Error);
    // Continue with database deletion even if S3 fails
  }

  // Delete from database
  await File.findByIdAndDelete(fileId);

  // Update parent directory size
  if (parentDirId) {
    await updateDirectorySizes(parentDirId);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedFileId: fileId,
        deletedFileName: file.name,
      },
      "File deleted successfully",
    ),
  );
});

export const ShareFile = asyncHandler(async (req, res) => {
  const { success, data, error } = shareFileSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId, shareType, expiryHours, sharedWithUserIds } = data;
  const userId = req.user._id;

  // Find file and verify ownership
  const file = await File.findOne({
    _id: fileId,
    userId,
  });

  if (!file) {
    throw new ApiError(404, "File not found or access denied");
  }

  if (file.isUploading) {
    throw new ApiError(400, "Cannot share file that is still uploading");
  }

  const s3Key = generateS3Key(userId, fileId, file.extension);
  let shareUrl;
  let expiresAt = null;

  if (expiryHours) {
    expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
  }

  if (shareType === "public") {
    // Generate CloudFront signed URL for public sharing
    const expiryMinutes = expiryHours ? expiryHours * 60 : 1440; // Default 24 hours
    shareUrl = generateSignedUrl(s3Key, expiryMinutes);
  } else if (shareType === "private") {
    // Private sharing - verify users exist
    if (!sharedWithUserIds || sharedWithUserIds.length === 0) {
      throw new ApiError(400, "Please specify user IDs for private sharing");
    }

    // Verify all users exist
    const users = await User.find({ _id: { $in: sharedWithUserIds } });
    if (users.length !== sharedWithUserIds.length) {
      throw new ApiError(400, "One or more user IDs are invalid");
    }

    // TODO: Create Share model/collection to track private shares
    // For now, return a URL to the shared file endpoint
    shareUrl = `${envConfig.APP_URL || "http://localhost:5000"}/api/files/shared/${fileId}`;
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        shareUrl,
        shareType,
        expiresAt,
        sharedWith: shareType === "private" ? sharedWithUserIds : null,
        file: {
          _id: file._id,
          name: file.name,
          size: file.size,
          extension: file.extension,
        },
      },
      `File shared ${shareType}ly successfully`,
    ),
  );
});

export const GetPublicFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;

  // Validate file ID
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new ApiError(400, "Invalid file ID");
  }

  // Find file
  const file = await File.findById(fileId);

  if (!file) {
    throw new ApiError(404, "File not found");
  }

  if (file.isUploading) {
    throw new ApiError(400, "File is not available yet");
  }

  // TODO: Add permission check here
  // Check if the file is shared publicly or if the requesting user has access

  // Generate CloudFront signed URL
  const s3Key = generateS3Key(file.userId, fileId, file.extension);
  const downloadUrl = generateDownloadUrl(s3Key, 60); // 60 minutes expiry

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          name: file.name,
          size: file.size,
          extension: file.extension,
          createdAt: file.createdAt,
        },
        downloadUrl,
        expiresIn: 3600, // 60 minutes in seconds
      },
      "Public file retrieved successfully",
    ),
  );
});

export const MoveFile = asyncHandler(async (req, res) => {
  const { success, data, error } = moveFileSchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { fileId, newParentDirId } = data;
  const userId = req.user._id;

  const file = await File.findOne({ _id: fileId, userId });

  if (!file) {
    throw new ApiError(404, "File not found");
  }

  // Verify new parent directory if provided
  if (newParentDirId) {
    const newParent = await Directory.findOne({
      _id: newParentDirId,
      userId,
    });

    if (!newParent) {
      throw new ApiError(404, "Target directory not found");
    }
  }

  const oldParentId = file.parentDirId;

  // Move file
  file.parentDirId = newParentDirId || null;
  await file.save();

  // Update both old and new parent directory sizes
  if (oldParentId) {
    await updateDirectorySizes(oldParentId);
  }
  if (newParentDirId) {
    await updateDirectorySizes(newParentDirId);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        file: {
          _id: file._id,
          name: file.name,
          size: file.size,
          extension: file.extension,
          parentDirId: file.parentDirId,
          updatedAt: file.updatedAt,
        },
      },
      "File moved successfully",
    ),
  );
});

export const GetFilesInDirectory = asyncHandler(async (req, res) => {
  const { success, data, error } = getFilesInDirectorySchema.safeParse(
    req.params,
  );

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { directoryId } = data;
  const userId = req.user._id;

  const query = {
    userId,
    parentDirId: directoryId && directoryId !== "root" ? directoryId : null,
  };

  const files = await File.find(query)
    .select("name size extension isUploading createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        files,
        count: files.length,
        directoryId: directoryId || null,
      },
      "Files retrieved successfully",
    ),
  );
});
