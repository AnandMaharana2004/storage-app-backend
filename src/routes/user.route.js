import express from "express";
import {
  AllUsers,
  ConformationProfilePicUploaded,
  DeleteUser,
  DeleteUserSessions,
  getCurrentUser,
  SearchUserByNameOrEmail,
  UpdateProfileName,
  UpdateProfilePic,
} from "../controller/userController.js";
import { authenticate, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get("/all", AllUsers); // GET /api/users/all?page=1&limit=10
router.get("/me", getCurrentUser);
router.get("/search", SearchUserByNameOrEmail); // GET /api/users/search?search=john&page=1&limit=10
router.delete("/delete", isAdmin, DeleteUser);
router.delete("/sessions", DeleteUserSessions);
router.post("/update/name", UpdateProfileName);
router.post("/profilePic/update", UpdateProfilePic);
router.post("/profilePic/conformation", ConformationProfilePicUploaded);

export default router;
