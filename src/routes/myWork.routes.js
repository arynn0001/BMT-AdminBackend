/**
 * My Work Routes
 */

import { Router } from "express";
import * as controller from "../controllers/myWork.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes (dashboard data)
router.get("/stats", controller.getStats);
router.get("/queue", controller.getQueue);
router.get("/workspaces", controller.getWorkspaces);
router.get("/shift", controller.getShift);
router.get("/recent-completions", controller.getRecentCompletions);

// POST routes (data add)
router.post("/tasks", controller.createTask);
router.post("/workspaces", controller.createWorkspace);
router.post("/completions", controller.createCompletion);
router.post("/shift", controller.createShift);

export default router;