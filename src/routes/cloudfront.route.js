import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import { RefreshCloudFrontCookies } from "../controller/cloudFrontController";

const router = Router;

router.use(authenticate);

router.post("/refresh-token", RefreshCloudFrontCookies);
