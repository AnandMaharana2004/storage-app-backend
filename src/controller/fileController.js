import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

export const RequestUploadUrl = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, null, "Request upload url under process"));
});

export const CompleteUpload = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, null, "Complete Upload under constraction"));
});

export const GetFile = asyncHandler(async (req, res) => {
  // here we serve the cloudfront url
  res
    .status(200)
    .json(new ApiResponse(200, null, "Get File under Constraction"));
});

export const RenameFile = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, null, "Rename File under constraction"));
});

export const DeleteFile = asyncHandler(async (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, null, "Delete File under constraction"));
});

export const ShareFile = asyncHandler(async (req, res) => {
  // share file privately (who can see this files with expiry time) or publick with expiry time
  res
    .status(200)
    .json(new ApiResponse(200, null, "Share File feature under constraction"));
});

export const GetPublicFile = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, null, "GetPublic file under process"));
});
