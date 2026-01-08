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
  moveFileSchema,
  getFilesInDirectorySchema,
  MoveFileToTrashSchema,
  RemoveFromTrashSchema,
  DownloadUrlSchema,
} from "../validators/fileSchema.js";
import { cancelDelete, scheduleDelete } from "../service/trashService.js";

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
  return `cdn/private/users-${userId}/${fileId}-${extension}`;
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
    throw new ApiError(400, error.issues[0].message);
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
    s3Key,
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
          url: file.url,
          deletedAt: file.deletedAt || null,
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

  // Delete from S3
  try {
    await deleteObject({
      bucketName: envConfig.AWS_BUCKET_NAME,
      key: file.s3Key,
    });

    // Invalidate CloudFront cache for the deleted file
    await invalidateCloudFront([`/${file.s3Key}`]);
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

export const MoveFileToTrash = asyncHandler(async (req, res) => {
  const { success, data } = MoveFileToTrashSchema.safeParse(req.body);
  if (!success) throw new ApiError(400, "Please provide fileId");

  const { fileId } = data;

  const file = await File.findById(fileId);
  if (!file) throw new ApiError(404, "File not found");

  if (file.deletedAt) {
    return res
      .status(200)
      .json(new ApiResponse(200, { fileId }, "File already in trash"));
  }

  const deleteAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await File.updateOne({ _id: fileId }, { deletedAt: deleteAt });

  // 🔥 schedule delete job
  // await scheduleDelete(file, 24 * 60 * 60 * 1000);
  await scheduleDelete(file, 2 * 60 * 1000); // for local environment

  res
    .status(200)
    .json(new ApiResponse(200, { fileId, deleteAt }, "File moved to trash"));
});

export const RemoveFromTrash = asyncHandler(async (req, res) => {
  const { success, data } = RemoveFromTrashSchema.safeParse(req.body);
  if (!success) throw new ApiError(400, "Please provide fileId");

  const { fileId } = data;

  const file = await File.findById(fileId);
  if (!file) throw new ApiError(404, "File not found");

  if (!file.deletedAt) {
    return res
      .status(200)
      .json(new ApiResponse(200, { fileId }, "File is not in trash"));
  }

  // 🔥 cancel scheduled job
  await cancelDelete(fileId);

  await File.updateOne({ _id: fileId }, { $unset: { deletedAt: "" } });

  res
    .status(200)
    .json(new ApiResponse(200, { fileId }, "File restored successfully"));
});

export const DownloadUrl = asyncHandler(async (req, res) => {
  const { success, data, error } = DownloadUrlSchema.safeParse(req.body);

  if (!success || error) throw new ApiError(400, "File id missing");

  const file = await File.findOne({
    _id: data.fileId,
    userId: req.user._id,
  }).select("url name s3Key");

  if (!file) throw new ApiError(400, "File not found or access deny");

  const downloadUrl = await generateSignedUrl(`${file.s3Key.slice(4)}`, 5, {
    isForDownload: true,
    fileName: file.name,
  });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        downloadUrl,
        fileName: file.name,
      },
      "file download url got successfully",
    ),
  );
});

export const GetAllTrashFiles = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Get all deleted files
  const trashedFiles = await File.find({
    userId,
    deletedAt: { $exists: true, $ne: null },
  })
    .select(
      "name size extension url parentDirId deletedAt createdAt updatedAt isUploading",
    )
    .sort({ deletedAt: -1 })
    .lean();

  // Build paths for each file
  const filesWithPaths = await Promise.all(
    trashedFiles.map(async (file) => {
      const pathSegments = [];
      let currentDirId = file.parentDirId;

      // Traverse up the directory tree
      while (currentDirId) {
        const dir = await Directory.findOne({
          _id: currentDirId,
          userId,
        })
          .select("name parentDirId")
          .lean();

        if (!dir) break;

        pathSegments.unshift({
          _id: dir._id,
          name: dir.name,
        });

        currentDirId = dir.parentDirId;
      }

      // Build path string
      const path =
        pathSegments.length > 0
          ? "/" + pathSegments.map((seg) => seg.name).join("/")
          : "/";

      return {
        ...file,
        path,
        pathSegments:
          pathSegments.length > 0
            ? pathSegments
            : [{ _id: null, name: "Root" }],
      };
    }),
  );

  // Group by deletion date
  const groupedByDate = filesWithPaths.reduce((acc, file) => {
    const deletedDate = new Date(file.deletedAt).toDateString();
    if (!acc[deletedDate]) {
      acc[deletedDate] = {
        date: deletedDate,
        files: [],
        count: 0,
        totalSize: 0,
      };
    }
    acc[deletedDate].files.push(file);
    acc[deletedDate].count++;
    acc[deletedDate].totalSize += file.size;
    return acc;
  }, {});

  // Convert to array and sort by date (most recent first)
  const sortedGroupedByDate = Object.values(groupedByDate).sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  // Calculate total stats
  const totalFiles = filesWithPaths.length;
  const totalSize = filesWithPaths.reduce((sum, file) => sum + file.size, 0);

  const response = {
    groupedByDate: sortedGroupedByDate,
    stats: {
      totalFiles,
      totalSize,
    },
  };

  res
    .status(200)
    .json(new ApiResponse(200, response, "Trash files retrieved successfully"));
});
