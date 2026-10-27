/**
 * Situation Report Routes
 */

import { Router } from "express";
import * as controller from "../controllers/situationReport.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/sections", controller.getSections);
router.get("/preview", controller.getPreview);
router.get("/list", controller.getList);
router.get("/:id", controller.getOne);

// Actions
router.post("/generate", controller.generate);
router.post("/schedule", controller.schedule);

// Delete
router.delete("/:id", controller.remove);

export default router;