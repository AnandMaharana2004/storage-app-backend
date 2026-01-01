import express from "express";
import {
  RequestUploadUrl,
  CompleteUpload,
  GetFile,
  RenameFile,
  DeleteFile,
  ShareFile,
  GetPublicFile,
  MoveFile,
  MoveFileToTrash,
  GetFilesInDirectory,
  RemoveFromTrash,
  DownloadUrl,
} from "../controller/fileController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// public route
router.get("/shared/:fileId", GetPublicFile);

// private routes
router.use(authenticate);
router.post("/upload/request", RequestUploadUrl);
router.post("/upload/complete", CompleteUpload);
router.get("/:fileId", GetFile);
router.get("/directory/:directoryId", GetFilesInDirectory);
router.patch("/rename", RenameFile);
router.patch("/move", MoveFile);
router.post("/share", ShareFile);
router.delete("/delete", DeleteFile);
router.patch("/move-to-trash", MoveFileToTrash);
router.patch("/remove-from-trash", RemoveFromTrash);
router.post("/download", DownloadUrl);

export default router;
