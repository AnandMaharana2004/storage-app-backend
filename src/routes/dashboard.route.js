import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import {
  GetAllTrashFiles,
  GetDashboard,
} from "../controller/dashboardController.js";

const router = Router();

router.use(authenticate);

router.get("/", GetDashboard);
router.get("/trash", GetAllTrashFiles);
export default router;
