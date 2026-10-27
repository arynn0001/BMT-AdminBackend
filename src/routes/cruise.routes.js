import { Router } from "express";

// TODO: apna admin auth middleware yahan lagao (jaise baaki admin routes me use ho raha hai)
// import { authenticate, requireRole } from "../middleware/auth.middleware.js";

import {
  RESOURCES,
  getOverview,
  listCruiseVendors,
  listResource,
  getResourceById,
  updateResourceStatus,
} from "../controllers/cruise.controller.js";

const router = Router();

// router.use(authenticate);   // <- admin auth enable karo

router.get("/overview", getOverview);
router.get("/vendors", listCruiseVendors);

// ships, itineraries, sailings, cabins, pricing, availability, bookings
for (const key of Object.keys(RESOURCES)) {
  router.get(`/${key}`, listResource(key));
  router.get(`/${key}/:id`, getResourceById(key));

  if (RESOURCES[key].statuses) {
    router.patch(`/${key}/:id/status`, updateResourceStatus(key));
  }
}

export default router;