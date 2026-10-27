/**
 * Cab Routes - Admin Panel
 */

import { Router } from "express";
import * as controller from "../controllers/cab.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

/* =========================================================
   ⚠️ ORDER MATTERS
   Specific routes pehle, generic (/:id) sabse aakhir me
   ========================================================= */

/* ---------- DASHBOARD / STATS ---------- */
router.get("/stats", controller.getStats);
router.get("/live-fleet", controller.getLiveFleet);
router.get("/drivers", controller.getDrivers);
router.get("/vendors/stats", controller.getVendorStats);

/* ---------- BOOKINGS (specific routes pehle) ---------- */
router.get("/bookings/stats", controller.getBookingStats);
router.get("/bookings/list", controller.getBookings);
router.get("/bookings/:id", controller.getBookingById);
router.patch("/bookings/:id/status", controller.updateBookingStatus);
router.post("/bookings/:id/cancel", controller.cancelBooking);

/* ---------- CAB LIST ---------- */
router.get("/list", controller.getList);

/* ---------- CAB ACTIONS (id-based) ---------- */
router.post("/:id/approve", controller.approve);
router.post("/:id/reject", controller.reject);
router.patch("/:id/toggle", controller.toggleActive);

/* ---------- CAB CRUD ---------- */
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

/* ---------- SINGLE CAB (sabse aakhir me) ---------- */
router.get("/:id", controller.getOne);

export default router;