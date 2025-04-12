import express from "express";
import {
  Login,
  Register,
  getCurrentUser,
  logout,
} from "../controllers/auth.controller";
import { authMiddleware } from "middleware/auth.middleware";

const router = express.Router();

router.post("/register", Register);
router.post("/login", Login);
router.post("/logout", logout);
router.get("/me", authMiddleware, getCurrentUser);

export default router;
