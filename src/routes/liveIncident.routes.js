/**
 * Live Incident Routes
 */

import { Router } from "express";
import * as controller from "../controllers/liveIncident.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/stats", controller.getStats);
router.get("/list", controller.getList);
router.get("/:id", controller.getOne);

// POST/PUT/DELETE - Admin panel actions
router.post("/", controller.create);                    // Declare incident
router.post("/:id/status", controller.updateStatus);    // Change status
router.delete("/:id", controller.remove);               // Remove incident

export default router;