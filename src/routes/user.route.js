import express from "express";
import {
  AllUsers,
  DeleteUser,
  DeleteUserSessions,
  getCurrentUser,
  SearchUserByNameOrEmail,
} from "../controller/userController";
import { authenticate, isAdmin } from "../middleware/authMiddleware";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get("/all", AllUsers); // GET /api/users/all?page=1&limit=10
router.get("/me", getCurrentUser);
router.get("/search", SearchUserByNameOrEmail); // GET /api/users/search?search=john&page=1&limit=10
router.delete("/delete", isAdmin, DeleteUser);
router.delete("/sessions", DeleteUserSessions);

export default router;
