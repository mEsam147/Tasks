import { Router } from "express";

import { authMiddleware } from "../middleware/auth.middleware";
import {
  createTask,
  deleteTask,
  GetTasks,
  updateTask,
} from "../controllers/task.controller";

const router = Router();

router.get("/", authMiddleware, GetTasks);

router.post("/", authMiddleware, createTask);

router.put("/:taskId", authMiddleware, updateTask);

router.delete("/:taskId", authMiddleware, deleteTask);

export default router;
