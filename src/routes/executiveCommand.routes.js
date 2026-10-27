/**
 * Executive Command Routes
 */

import { Router } from "express";
import * as controller from "../controllers/executiveCommand.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

// GET routes (dashboard)
router.get("/executive-stats", controller.getExecutiveStats);
router.get("/service-health", controller.getServiceHealth);
router.get("/command-now", controller.getCommandNow);
router.get("/module-cards", controller.getModuleCards);
router.get("/operating-controls", controller.getOperatingControls);

// POST routes (data add)
router.post("/customers", controller.createCustomer);
router.post("/bookings", controller.createBooking);
router.post("/service-health", controller.createServiceHealth);
router.post("/command-actions", controller.createCommandAction);

export default router;