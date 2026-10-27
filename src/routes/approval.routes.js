/**
 * Approval Center Routes
 */

import { Router } from "express";
import * as controller from "../controllers/approval.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/stats", controller.getStats);
router.get("/list", controller.getList);
router.get("/:id", controller.getOne);

// Action routes
router.post("/:id/approve", controller.approve);
router.post("/:id/reject", controller.reject);

// Create
router.post("/", controller.create);

export default router;