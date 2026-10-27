/**
 * Postmortem Routes
 */

import { Router } from "express";
import * as controller from "../controllers/postmortem.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/stats", controller.getStats);
router.get("/list", controller.getList);
router.get("/:id", controller.getOne);

// Actions
router.put("/:id/actions", controller.updateActions);
router.post("/:id/approve", controller.approve);

// Admin CRUD
router.post("/", controller.create);
router.delete("/:id", controller.remove);

export default router;