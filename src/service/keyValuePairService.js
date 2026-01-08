import {
  PutKeyCommand,
  GetKeyCommand,
  DeleteKeyCommand,
} from "@aws-sdk/client-cloudfront-keyvaluestore";

import { KVS_CONFIG, kvsClient } from "../config/keyValueStore.config.js";
import { ApiError } from "../utils/ApiError.js";

const buildShareKey = (shareId) => `${KVS_CONFIG.SHARE_KEY_PREFIX}:${shareId}`;

export const ensureShareKVSMapping = async ({
  shareId,
  assetsId,
  ownerId,
  fileName,
}) => {
  try {
    const kvsKey = buildShareKey(shareId);

    const kvsValue = JSON.stringify({
      s3Path: `users/${ownerId}/files/${assetsId}`,
      fileName,
      assetsId,
      createdAt: new Date().toISOString(),
    });

    const command = new PutKeyCommand({
      KvsARN: KVS_CONFIG.KVS_ARN,
      Key: kvsKey,
      Value: kvsValue,
    });

    await kvsClient.send(command);

    console.log(`✅ KVS mapping saved: ${kvsKey}`);
  } catch (error) {
    console.error("❌ KVS put failed:", error);
    throw new ApiError(500, "Failed to create share mapping");
  }
};

export const getShareKVSMapping = async (shareId) => {
  try {
    const kvsKey = buildShareKey(shareId);

    const command = new GetKeyCommand({
      KvsARN: KVS_CONFIG.KVS_ARN,
      Key: kvsKey,
    });

    const response = await kvsClient.send(command);

    return JSON.parse(response.Value);
  } catch (error) {
    if (error.name === "ResourceNotFoundException") {
      return null;
    }
    throw error;
  }
};

export const deleteShareKVSMapping = async (shareId) => {
  try {
    const kvsKey = buildShareKey(shareId);

    const command = new DeleteKeyCommand({
      KvsARN: KVS_CONFIG.KVS_ARN,
      Key: kvsKey,
    });

    await kvsClient.send(command);

    console.log(`🗑️ KVS mapping deleted: ${kvsKey}`);
  } catch (error) {
    if (error.name === "ResourceNotFoundException") return;
    console.error("❌ KVS delete failed:", error);
  }
};
