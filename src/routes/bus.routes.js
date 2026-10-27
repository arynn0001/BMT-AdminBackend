/**
 * Bus Routes - Admin Panel
 *
 * ⚠️ ORDER MATTERS — specific routes pehle, generic (/:id) sabse aakhir
 */

import { Router } from "express";
import * as controller from "../controllers/bus.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

/* ---------- DASHBOARD ---------- */
router.get("/stats", controller.getStats);
router.get("/live-departures", controller.getLiveDepartures);
router.get("/crew-status", controller.getCrewStatus);
router.get("/vendors/stats", controller.getVendorStats);

/* ---------- BOOKINGS (specific routes pehle) ---------- */
router.get("/bookings/stats", controller.getBookingStats);
router.get("/bookings/list", controller.getBookings);
router.get("/bookings/:id", controller.getBookingById);
router.patch("/bookings/:id/status", controller.updateBookingStatus);
router.post("/bookings/:id/cancel", controller.cancelBooking);

/* ---------- BUS LIST ---------- */
router.get("/list", controller.getList);

/* ---------- ACTIONS ---------- */
router.post("/reconcile-offline", controller.reconcileOfflineEvents);
router.post("/sync-vendor", controller.syncFromVendor);
router.post("/sync-buses", controller.syncBusesFromVendor);

/* ---------- CRUD ---------- */
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

/* ---------- SINGLE BUS (sabse aakhir me) ---------- */
router.get("/:id", controller.getOne);

export default router;