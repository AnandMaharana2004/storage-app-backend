import { CloudFrontKeyValueStoreClient } from "@aws-sdk/client-cloudfront-keyvaluestore";
import envConfig from "./env.js";

// CloudFront Key Value Store Client
// NOTE:
// - In production (EC2 / ECS / Lambda), REMOVE credentials block
// - AWS SDK will auto-resolve IAM Role credentials

export const kvsClient = new CloudFrontKeyValueStoreClient({
  region: envConfig.AWS_REGION || "us-east-1",
  ...(envConfig.AWS_ACCESS_KEY_ID &&
    envConfig.AWS_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
        secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY,
      },
    }),
});

export const KVS_CONFIG = {
  SHARE_KEY_PREFIX: "share",
  KVS_ARN: envConfig.CLOUDFRONT_KVS_ARN,
};
