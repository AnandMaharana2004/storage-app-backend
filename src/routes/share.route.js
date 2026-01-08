import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { ShareAssets } from "../controller/shareController.js";

const router = Router();

router.post("/", authenticate, ShareAssets);

export default router;
