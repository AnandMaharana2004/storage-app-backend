import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  CheckShare,
  DisablePublicShare,
  GetPublicFile,
  SharePublicFile,
} from "../controller/shareController.js";

const router = Router();

router.get("/public/exist", CheckShare);
router.get("/public/:sharedToken", GetPublicFile);
router.use(authenticate);
// router.post("/", ShareAssets);
router.post("/public", SharePublicFile);
router.delete("/public/:fileId", DisablePublicShare);

export default router;
