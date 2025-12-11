import { model, Schema } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

sessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

sessionSchema.index({ userId: 1, createdAt: -1 });

const Session = model("Session", sessionSchema);

export default Session;
