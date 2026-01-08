import mongoose from "mongoose";
import Directory from "../models/directoryModel.js";
import File from "../models/fileModel.js";
import User from "../models/userModel.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import {
  createDirectorySchema,
  deleteDirectorySchema,
  getDirectorySchema,
  MoveDirectorySchema,
  updateDirectorySchema,
} from "../validators/directorySchema.js";

async function calculateDirectorySize(directoryId) {
  const files = await File.find({ parentDirId: directoryId });
  let totalSize = files.reduce((sum, file) => sum + file.size, 0);

  const subdirectories = await Directory.find({ parentDirId: directoryId });

  for (const subdir of subdirectories) {
    totalSize += await calculateDirectorySize(subdir._id);
  }

  return totalSize;
}

async function updateParentSizes(directoryId) {
  const directory = await Directory.findById(directoryId);
  if (!directory) return;

  const newSize = await calculateDirectorySize(directoryId);
  await Directory.findByIdAndUpdate(directoryId, { size: newSize });

  // Recursively update parent
  if (directory.parentDirId) {
    await updateParentSizes(directory.parentDirId);
  }
}

export const CreateDirectory = asyncHandler(async (req, res) => {
  const { success, data, error } = createDirectorySchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { name, parentDirId } = data;
  const userId = req.user._id;

  if (parentDirId) {
    const parentDir = await Directory.findOne({
      _id: parentDirId,
      userId,
    });

    if (!parentDir) {
      throw new ApiError(404, "Parent directory not found or access denied");
    }
  }

  // Check if directory with same name already exists in parent
  const existingDir = await Directory.findOne({
    name,
    userId,
    parentDirId: parentDirId || null,
  });

  if (existingDir) {
    throw new ApiError(
      409,
      "Directory with this name already exists in this location",
    );
  }

  // Create directory
  const directory = await Directory.create({
    name,
    userId,
    parentDirId: parentDirId || null,
    size: 0,
  });

  res
    .status(201)
    .json(new ApiResponse(201, directory, "Directory created successfully"));
});

export const UpdateDirectoryName = asyncHandler(async (req, res) => {
  const { success, data, error } = updateDirectorySchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { directoryId, name } = data;
  const userId = req.user._id;

  // Find directory and verify ownership
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
  });

  if (!directory) {
    throw new ApiError(404, "Directory not found or access denied");
  }

  // Check if it's the root directory
  const user = await User.findById(userId);
  if (user.rootDirId && user.rootDirId.toString() === directoryId) {
    throw new ApiError(400, "Cannot rename root directory");
  }

  // Check if directory with same name already exists in parent
  const existingDir = await Directory.findOne({
    name,
    userId,
    parentDirId: directory.parentDirId,
    _id: { $ne: directoryId },
  });

  if (existingDir) {
    throw new ApiError(
      409,
      "Directory with this name already exists in this location",
    );
  }

  // Update directory name
  directory.name = name;
  await directory.save();

  res
    .status(200)
    .json(
      new ApiResponse(200, directory, "Directory name updated successfully"),
    );
});

export const GetDirectory = asyncHandler(async (req, res) => {
  const { success, data, error } = getDirectorySchema.safeParse(req.params);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  let { directoryId } = data;
  const userId = req.user._id;

  if (!directoryId || directoryId === "null") {
    directoryId = req.rootDir;
  }

  const directoryObjectId = new mongoose.Types.ObjectId(directoryId);

  // Find directory and verify ownership (exclude deleted)
  const directory = await Directory.findOne({
    _id: directoryObjectId,
    userId,
    deletedAt: { $exists: false }, // Exclude soft-deleted directories
  }).lean();

  if (!directory) {
    throw new ApiError(404, "Directory not found or access denied");
  }

  // Get subdirectories with their DEEP file and folder counts (nested)
  const subdirectories = await Directory.aggregate([
    {
      $match: {
        parentDirId: directoryObjectId,
        userId,
        deletedAt: { $exists: false }, // Exclude soft-deleted directories
      },
    },
    {
      $graphLookup: {
        from: "directories",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentDirId",
        as: "allSubdirectories",
        restrictSearchWithMatch: {
          userId,
          deletedAt: { $exists: false }, // Exclude soft-deleted in nested lookup
        },
      },
    },
    {
      $lookup: {
        from: "files",
        let: {
          dirId: "$_id",
          allSubDirIds: "$allSubdirectories._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $or: [
                      { $eq: ["$parentDirId", "$$dirId"] },
                      { $in: ["$parentDirId", "$$allSubDirIds"] },
                    ],
                  },
                  { $eq: ["$userId", userId] },
                ],
              },
              deletedAt: { $exists: false }, // Exclude soft-deleted files
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalSize: { $sum: "$size" },
            },
          },
        ],
        as: "fileStats",
      },
    },
    {
      $addFields: {
        fileCount: {
          $ifNull: [{ $arrayElemAt: ["$fileStats.count", 0] }, 0],
        },
        folderCount: { $size: "$allSubdirectories" },
        filesSize: {
          $ifNull: [{ $arrayElemAt: ["$fileStats.totalSize", 0] }, 0],
        },
      },
    },
    {
      $project: {
        name: 1,
        size: 1,
        createdAt: 1,
        updatedAt: 1,
        parentDirId: 1,
        fileCount: 1,
        folderCount: 1,
        totalSizeInByte: { $add: ["$filesSize", "$size"] },
      },
    },
    {
      $sort: { name: 1 },
    },
  ]);

  // Get all files in this directory (direct children only, exclude deleted)
  const files = await File.find({
    parentDirId: directoryObjectId,
    userId,
    deletedAt: { $exists: false }, // Exclude soft-deleted files
  })
    .select(
      "name size extension isUploading parentDirId createdAt updatedAt url",
    )
    .sort({ name: 1 })
    .lean();

  // Get current directory DEEP stats (including all nested content)
  const directoryStats = await Directory.aggregate([
    {
      $match: {
        _id: directoryObjectId,
        userId,
        deletedAt: { $exists: false }, // Exclude soft-deleted
      },
    },
    {
      $graphLookup: {
        from: "directories",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentDirId",
        as: "allSubdirectories",
        restrictSearchWithMatch: {
          userId,
          deletedAt: { $exists: false }, // Exclude soft-deleted in nested lookup
        },
      },
    },
    {
      $lookup: {
        from: "files",
        let: {
          dirId: "$_id",
          allSubDirIds: "$allSubdirectories._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $or: [
                      { $eq: ["$parentDirId", "$$dirId"] },
                      { $in: ["$parentDirId", "$$allSubDirIds"] },
                    ],
                  },
                  { $eq: ["$userId", userId] },
                ],
              },
              deletedAt: { $exists: false }, // Exclude soft-deleted files
            },
          },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              totalSize: { $sum: "$size" },
            },
          },
        ],
        as: "fileStats",
      },
    },
    {
      $lookup: {
        from: "directories",
        let: { dirId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$parentDirId", "$$dirId"] },
                  { $eq: ["$userId", userId] },
                ],
              },
              deletedAt: { $exists: false }, // Exclude soft-deleted
            },
          },
          {
            $count: "count",
          },
        ],
        as: "directSubdirs",
      },
    },
    {
      $lookup: {
        from: "files",
        let: { dirId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$parentDirId", "$$dirId"] },
                  { $eq: ["$userId", userId] },
                ],
              },
              deletedAt: { $exists: false }, // Exclude soft-deleted files
            },
          },
          {
            $count: "count",
          },
        ],
        as: "directFiles",
      },
    },
    {
      $project: {
        // Direct children counts (for immediate display)
        directFileCount: {
          $ifNull: [{ $arrayElemAt: ["$directFiles.count", 0] }, 0],
        },
        directFolderCount: {
          $ifNull: [{ $arrayElemAt: ["$directSubdirs.count", 0] }, 0],
        },
        // Total nested counts (for size calculation)
        totalFileCount: {
          $ifNull: [{ $arrayElemAt: ["$fileStats.count", 0] }, 0],
        },
        totalFolderCount: { $size: "$allSubdirectories" },
        totalSizeInByte: {
          $add: [
            { $ifNull: [{ $arrayElemAt: ["$fileStats.totalSize", 0] }, 0] },
            "$size",
          ],
        },
      },
    },
  ]);

  const currentDirStats = directoryStats[0] || {
    directFileCount: 0,
    directFolderCount: 0,
    totalFileCount: 0,
    totalFolderCount: 0,
    totalSizeInByte: directory.size,
  };

  // Optimized breadcrumb path using aggregation (exclude deleted)
  const breadcrumbs = await Directory.aggregate([
    {
      $match: {
        _id: directoryObjectId,
        userId,
        deletedAt: { $exists: false },
      },
    },
    {
      $graphLookup: {
        from: "directories",
        startWith: "$parentDirId",
        connectFromField: "parentDirId",
        connectToField: "_id",
        as: "ancestors",
        restrictSearchWithMatch: {
          userId,
          deletedAt: { $exists: false }, // Exclude soft-deleted from breadcrumbs
        },
      },
    },
    {
      $project: {
        path: {
          $concatArrays: ["$ancestors", ["$$ROOT"]],
        },
      },
    },
    {
      $unwind: "$path",
    },
    {
      $replaceRoot: { newRoot: "$path" },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        parentDirId: 1,
      },
    },
    {
      $sort: { parentDirId: 1 },
    },
  ]);

  // Sort breadcrumbs properly (root first)
  const sortedBreadcrumbs = [];
  const breadcrumbMap = new Map(breadcrumbs.map((b) => [b._id.toString(), b]));

  let current = breadcrumbs.find((b) => !b.parentDirId);
  while (current) {
    sortedBreadcrumbs.push({
      _id: current._id,
      name: current.name,
    });
    current = breadcrumbs.find(
      (b) =>
        b.parentDirId && b.parentDirId.toString() === current._id.toString(),
    );
  }

  const response = {
    directory: {
      _id: directory._id,
      name: directory.name,
      size: directory.size,
      parentDirId: directory.parentDirId,
      fileCount: currentDirStats.directFileCount, // Direct children only
      folderCount: currentDirStats.directFolderCount, // Direct children only
      totalSizeInByte: currentDirStats.totalSizeInByte, // Total including nested
      createdAt: directory.createdAt,
      updatedAt: directory.updatedAt,
      isRoot: !directory.parentDirId, // Flag to identify root folder
    },
    subdirectories,
    files,
    breadcrumbs: sortedBreadcrumbs,
  };

  res
    .status(200)
    .json(new ApiResponse(200, response, "Directory retrieved successfully"));
});

export const DeleteDirectory = asyncHandler(async (req, res) => {
  const { success, data, error } = deleteDirectorySchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { directoryId } = data;
  const userId = req.user._id;

  // Find directory and verify ownership
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
  });

  if (!directory) {
    throw new ApiError(404, "Directory not found or access denied");
  }

  // Check if it's the root directory
  const user = await User.findById(userId);
  if (user.rootDirId && user.rootDirId.toString() === directoryId) {
    throw new ApiError(400, "Cannot delete root directory");
  }

  // Recursively delete all subdirectories and files
  await deleteDirectoryRecursive(directoryId, userId);

  // Delete the directory itself
  await Directory.findByIdAndDelete(directoryId);

  // Update parent directory sizes
  if (directory.parentDirId) {
    await updateParentSizes(directory.parentDirId);
  }

  res.status(200).json(
    new ApiResponse(
      200,
      {
        deletedDirectoryId: directoryId,
      },
      "Directory deleted successfully",
    ),
  );
});

// Helper function to recursively delete directories and files
async function deleteDirectoryRecursive(directoryId, userId) {
  // Get all subdirectories
  const subdirectories = await Directory.find({
    parentDirId: directoryId,
    userId,
  });

  // Recursively delete subdirectories
  for (const subdir of subdirectories) {
    await deleteDirectoryRecursive(subdir._id, userId);
    await Directory.findByIdAndDelete(subdir._id);
  }

  const files = await File.find({
    parentDirId: directoryId,
    userId,
  });

  for (const file of files) {
    // TODO: Delete file from S3
    // await deleteFileFromS3(file._id);
    await File.findByIdAndDelete(file._id);
  }
}

export const MoveDirectory = asyncHandler(async (req, res) => {
  const { success, data, error } = MoveDirectorySchema.safeParse(req.body);

  if (!success) {
    throw new ApiError(400, error.errors[0].message);
  }

  const { directoryId, newParentDirId } = data;
  const userId = req.user._id;

  // Find directory
  const directory = await Directory.findOne({ _id: directoryId, userId });
  if (!directory) {
    throw new ApiError(404, "Directory not found");
  }

  // Check if it's root directory
  const user = await User.findById(userId);
  if (user.rootDirId && user.rootDirId.toString() === directoryId) {
    throw new ApiError(400, "Cannot move root directory");
  }

  // Verify new parent exists and isn't a subdirectory of the directory being moved
  if (newParentDirId) {
    const newParent = await Directory.findOne({ _id: newParentDirId, userId });
    if (!newParent) {
      throw new ApiError(404, "New parent directory not found");
    }

    // Check for circular reference
    let current = newParent;
    while (current) {
      if (current._id.toString() === directoryId) {
        throw new ApiError(
          400,
          "Cannot move directory into its own subdirectory",
        );
      }
      if (current.parentDirId) {
        current = await Directory.findById(current.parentDirId);
      } else {
        break;
      }
    }
  }

  const oldParentId = directory.parentDirId;

  // Update directory
  directory.parentDirId = newParentDirId || null;
  await directory.save();

  // Update old and new parent sizes
  if (oldParentId) {
    await updateParentSizes(oldParentId);
  }
  if (newParentDirId) {
    await updateParentSizes(newParentDirId);
  }

  res
    .status(200)
    .json(new ApiResponse(200, directory, "Directory moved successfully"));
});
