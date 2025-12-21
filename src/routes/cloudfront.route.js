import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { RefreshCloudFrontCookies } from "../controller/cloudFrontController.js";

const router = Router();

router.use(authenticate);

router.post("/refresh-token", RefreshCloudFrontCookies);

export default router;
