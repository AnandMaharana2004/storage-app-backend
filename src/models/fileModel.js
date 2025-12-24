import { model, Schema } from "mongoose";
import envConfig from "../config/env.js";

const fileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    extension: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    isUploading: {
      type: Schema.Types.Boolean,
    },
    parentDirId: {
      type: Schema.Types.ObjectId,
      ref: "Directory",
    },
    s3Key: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      // require : true
    },
    url: {
      type: String,
      require: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    strict: "throw",
    timestamps: true,
  },
);

fileSchema.pre("save", function (next) {
  if (!this.url && this.s3Key) {
    this.url = `${envConfig.CLOUDFRONT_DOMAIN}/${this.s3Key}`;
  }
});

const File = model("File", fileSchema);
export default File;

fileSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 86400 }, // 24 hours
);
