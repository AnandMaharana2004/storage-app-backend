import { S3Client } from "@aws-sdk/client-s3";
import envConfig from "./env.js";
import { CloudFrontClient } from "@aws-sdk/client-cloudfront";

export const s3Client = new S3Client({
  region: envConfig.AWS_REGION,
  credentials: {
    secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY,
    accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
  },
});

export const cloudFrontClient = new CloudFrontClient({
  region: "us-east-1",
});
