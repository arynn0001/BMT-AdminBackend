/**
 * Service Health Routes
 */

import { Router } from "express";
import * as controller from "../controllers/serviceHealth.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes
router.get("/stats", controller.getStats);
router.get("/list", controller.getList);
router.get("/:id", controller.getOne);

// Actions
router.post("/run-checks", controller.runChecks);  // "Run checks" button

// Admin CRUD
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;