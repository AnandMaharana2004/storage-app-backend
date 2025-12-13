import z from "zod";

export const loginSchema = z.object({
  email: z.email("please enter a valid email"),
  password: z.string(),
});

export const otpSchema = z.object({
  email: z.email("Please enter a valid email"),
  // otp: z
  //   .string("Please enter a valid 4 digit OTP string")
  //   .regex(/^\d{4}$/, "Please enter a valid 4 digit OTP"),
});

export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .min(3, "Name should be at least 3 characters")
    .max(100, "Name can be at max 100 characters"),
  otp: z
    .string("Please enter a valid 4 digit OTP string")
    .regex(/^\d{4}$/, "Please enter a valid 4 digit OTP"),
});

export const logoutSchema = z.object({
  all: z.boolean("missing field: all").optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Please provide a valid email"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string(),
    // .min(8, "Password must be at least 8 characters")
    // .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    // .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    // .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
