/**
 * Change Calendar Routes
 */

import { Router } from "express";
import * as controller from "../controllers/changeCalendar.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/stats", controller.getStats);
router.get("/list", controller.getList);
router.get("/blackouts", controller.getBlackouts);
router.get("/:id", controller.getOne);

// Actions
router.post("/:id/approve", controller.approve);
router.post("/:id/reject", controller.reject);

// Admin CRUD
router.post("/", controller.create);
router.delete("/:id", controller.remove);

export default router;