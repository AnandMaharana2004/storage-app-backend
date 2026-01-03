import z from "zod";

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "User ID is required").refine(isValidObjectId, {
    message: "Invalid MongoDB ObjectId format",
  }),
});

export const DeleteUserSessionsSchema = z.object({
  userId: z.string().min(1, "User ID is required").refine(isValidObjectId, {
    message: "Invalid MongoDB ObjectId format",
  }),
});

export const UpdateProfileNameSchema = z.object({
  name: z.string("User new name required").min(1),
});

export const UpdateProfilePicSchema = z.object({
  size: z
    .number()
    .positive("File size must be positive")
    .max(1 * 1024 * 1024, "File size must be less than 1MB"),

  extension: z.literal("image/webp", {
    errorMap: () => ({ message: "Only webp images are allowed" }),
  }),
});
