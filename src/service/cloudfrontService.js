import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import envConfig from "../config/env.js";
import { CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { cloudFrontClient } from "../config/aws.config.js";

export const generateSignedUrl = (s3ObjectKey, expiresInMinutes = 10) => {
  const url = `${envConfig.CLOUDFRONT_DOMAIN}/${s3ObjectKey}`;

  return getSignedUrl({
    url,
    keyPairId: envConfig.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: envConfig.AWS_CLOUDFRONT_PRIVATE_KEY,
    dateLessThan: new Date(Date.now() + expiresInMinutes * 60 * 1000),
  });
};

export const invalidateCloudFront = async (paths = []) => {
  if (!paths.length) return;

  const command = new CreateInvalidationCommand({
    DistributionId: envConfig.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      CallerReference: `${Date.now()}`,
      Paths: {
        Quantity: paths.length,
        Items: paths,
      },
    },
  });

  await cloudFrontClient.send(command);
};
