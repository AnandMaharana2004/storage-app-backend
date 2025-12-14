import { S3Client } from "@aws-sdk/client-s3";
import envConfig from "./env";

export const s3Client = new S3Client({
  region: envConfig.AWS_REGION,
  credentials: {
    secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY,
    accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
  },
});
