import mongoose from "mongoose";
import z from "zod";

const objectIdValidator = (id) => mongoose.Types.ObjectId.isValid(id);

export const shareSchema = z
  .object({
    fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
      message: "Invalid file ID",
    }),

    visibility: z.enum(["public", "private"], {
      message: "Share type must be 'public' or 'private'",
    }),

    expiryHours: z
      .number()
      .positive("Expiry hours must be positive")
      .optional(),

    sharedWithUserIds: z.array(z.string()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.visibility === "public" && data.sharedWithUserIds?.length) {
      ctx.addIssue({
        path: ["sharedWithUserIds"],
        message: "sharedWithUserIds must be empty for public visibility",
        code: z.ZodIssueCode.custom,
      });
    }
    if (
      data.visibility === "private" &&
      (!data.sharedWithUserIds || data.sharedWithUserIds.length === 0)
    ) {
      ctx.addIssue({
        path: ["sharedWithUserIds"],
        message: "sharedWithUserIds is required for private visibility",
        code: z.ZodIssueCode.custom,
      });
    }
  });

export const BlockShareSchema = z.object({
  shareId: z.string("Please provide sharedId"),
});

export const SharePublicFileSchema = z.object({
  fileId: z.string().min(1, "File ID is required").refine(objectIdValidator, {
    message: "Invalid file ID",
  }),
});

export const GetPublicFileSchema = z.object({
  sharedToken: z.string().min(1, "Please provide shared id"),
});

export const DisablePublicShareSchema = z.object({
  fileId: z.string().min(1, "Please provide shared id"),
});

export const CheckShareSchema = z.object({
  fileId: z.string().min(1, "Please provide shared id"),
});
