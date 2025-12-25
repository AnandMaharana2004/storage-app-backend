import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/aws.config.js";
import envConfig from "../config/env.js";

export const generatePreSignUrl = async ({
  bucketName = envConfig.AWS_BUCKET_NAME,
  key,
  contentType,
  expiresIn = 300,
}) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType, // optional but OK
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
};

// this is helpfull for direct upload from server
export const uploadObjet = ({
  bucketName = envConfig.AWS_BUCKET_NAME,
  key,
  body,
  contentType,
}) => {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return s3Client.send(command);
};

export const deleteObject = ({
  bucketName = envConfig.AWS_BUCKET_NAME,
  key,
}) => {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};

export const headObject = ({ bucketName = envConfig.AWS_BUCKET_NAME, key }) => {
  const command = new HeadObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return s3Client.send(command);
};
