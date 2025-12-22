import express from "express";
import {
  CreateDirectory,
  DeleteDirectory,
  GetDirectory,
  MoveDirectory,
  UpdateDirectoryName,
} from "../controller/directoryController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post("/create", CreateDirectory);
router.put("/update", UpdateDirectoryName);
router.get("/:directoryId", GetDirectory);
router.delete("/delete", DeleteDirectory);
router.put("/move", MoveDirectory);

export default router;
