import { z } from "zod";
import mongoose from "mongoose";

// Helper to validate MongoDB ObjectId
const objectIdValidator = (id) => mongoose.Types.ObjectId.isValid(id);

export const requestUploadSchema = z.object({
  name: z
    .string()
    .min(1, "File name is required")
    .max(255, "File name too long"),
  size: z.number().positive("File size must be positive"),
  extension: z
    .string()
    .min(1, "Extension is required")
    .max(10, "Extension too long"),
  parentDirId: z
    .string()
    .optional()
    .refine((id) => !id || objectIdValidator(id), {
      message: "Invalid directory ID",
    }),
});

export const completeUploadSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});

export const getFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});

export const renameFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
  newName: z
    .string()
    .min(1, "New name is required")
    .max(255, "File name too long"),
});

export const deleteFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});

export const shareFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
  shareType: z.enum(["public", "private"], {
    message: "Share type must be 'public' or 'private'",
  }),
  expiryHours: z.number().positive("Expiry hours must be positive").optional(),
  sharedWithUserIds: z.array(z.string()).optional(),
});

export const moveFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
  newParentDirId: z
    .string()
    .optional()
    .refine((id) => !id || objectIdValidator(id), {
      message: "Invalid directory ID",
    }),
});

export const getFilesInDirectorySchema = z.object({
  directoryId: z
    .string()
    .optional()
    .refine((id) => !id || id === "root" || objectIdValidator(id), {
      message: "Invalid directory ID",
    }),
});

export const MoveFileToTrashSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});
export const RemoveFromTrashSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});

export const DownloadUrlSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});
