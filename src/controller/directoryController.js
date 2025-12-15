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

  const { directoryId } = data;
  const userId = req.user._id;

  // Find directory and verify ownership
  const directory = await Directory.findOne({
    _id: directoryId,
    userId,
  }).lean();

  if (!directory) {
    throw new ApiError(404, "Directory not found or access denied");
  }

  // Get all subdirectories in this directory
  const subdirectories = await Directory.find({
    parentDirId: directoryId,
    userId,
  })
    .select("name size createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  // Get all files in this directory
  const files = await File.find({
    parentDirId: directoryId,
    userId,
  })
    .select("name size extension isUploading createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  // Get breadcrumb path
  const breadcrumbs = [];
  let currentDir = directory;

  while (currentDir) {
    breadcrumbs.unshift({
      _id: currentDir._id,
      name: currentDir.name,
    });

    if (currentDir.parentDirId) {
      currentDir = await Directory.findById(currentDir.parentDirId).lean();
    } else {
      break;
    }
  }

  const response = {
    directory: {
      _id: directory._id,
      name: directory.name,
      size: directory.size,
      parentDirId: directory.parentDirId,
      createdAt: directory.createdAt,
      updatedAt: directory.updatedAt,
    },
    subdirectories,
    files,
    breadcrumbs,
    stats: {
      totalSubdirectories: subdirectories.length,
      totalFiles: files.length,
      totalSize: directory.size,
    },
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
