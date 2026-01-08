import mongoose from "mongoose";
import z from "zod";

export const createDirectorySchema = z.object({
  name: z
    .string()
    .min(1, "Directory name is required")
    .max(255, "Name too long"),
  parentDirId: z
    .string()
    .optional()
    .refine((id) => !id || mongoose.Types.ObjectId.isValid(id), {
      message: "Invalid parent directory ID",
    }),
});

export const updateDirectorySchema = z.object({
  directoryId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "Invalid directory ID",
  }),
  name: z
    .string()
    .min(1, "Directory name is required")
    .max(255, "Name too long"),
});

export const getDirectorySchema = z.object({
  directoryId: z
    .string()
    .optional()
    .transform((id) => (id ? id : null))
    .refine((id) => id === null || mongoose.Types.ObjectId.isValid(id), {
      message: "Invalid directory ID",
    }),
});

export const deleteDirectorySchema = z.object({
  directoryId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "Invalid directory ID",
  }),
});

export const MoveDirectorySchema = z.object({
  directoryId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id)),
  newParentDirId: z
    .string()
    .optional()
    .refine((id) => !id || mongoose.Types.ObjectId.isValid(id)),
});
