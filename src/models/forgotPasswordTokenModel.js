import mongoose from "mongoose";
import crypto from "crypto";

const forgotPasswordTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

forgotPasswordTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

forgotPasswordTokenSchema.statics.hashToken = function (token) {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const ForgotPasswordToken = mongoose.model(
  "ForgotPasswordToken",
  forgotPasswordTokenSchema,
);

export default ForgotPasswordToken;
