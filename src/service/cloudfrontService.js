import { getSignedCookies, getSignedUrl } from "@aws-sdk/cloudfront-signer";
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

export const generateSignedCookies = (resourcePath = "/*", options = {}) => {
  const { expiresInMinutes = 60, ipAddress, dateGreaterThan } = options;

  const url = `${envConfig.CLOUDFRONT_DOMAIN}${resourcePath}`;

  const dateLessThanEpoch = Math.floor(
    (Date.now() + expiresInMinutes * 60 * 1000) / 1000,
  );

  const policy = {
    Statement: [
      {
        Resource: url,
        Condition: {
          DateLessThan: {
            "AWS:EpochTime": dateLessThanEpoch,
          },
          ...(dateGreaterThan && {
            DateGreaterThan: {
              "AWS:EpochTime": Math.floor(dateGreaterThan.getTime() / 1000),
            },
          }),
          ...(ipAddress && {
            IpAddress: {
              "AWS:SourceIp": ipAddress,
            },
          }),
        },
      },
    ],
  };

  return getSignedCookies({
    keyPairId: envConfig.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: envConfig.AWS_CLOUDFRONT_PRIVATE_KEY,
    policy: JSON.stringify(policy),
  });
};

export const getSignedCookieValues = (resourcePath = "/*", options = {}) => {
  const cookies = generateSignedCookies(resourcePath, options);

  return {
    "CloudFront-Policy": cookies["CloudFront-Policy"],
    "CloudFront-Signature": cookies["CloudFront-Signature"],
    "CloudFront-Key-Pair-Id": cookies["CloudFront-Key-Pair-Id"],
  };
};
