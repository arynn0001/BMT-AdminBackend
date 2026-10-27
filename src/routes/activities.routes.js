/**
 * Activities Routes - Admin Panel
 * Mounted at: /admin/activities
 *
 * ⚠️ ORDER MATTERS — specific routes pehle, generic (/:id) sabse aakhir
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getOverview,
  listActivities,
  getActivityById,
  updateActivityStatus,
  toggleActivity,
  getActivitySchedules,
  listSchedules,
  getScheduleById,
  toggleSchedule,
  listBookings,
  getBookingById,
  updateBookingStatus,
} from "../controllers/activities.controller.js";

const router = Router();

router.use(authenticate);

/* ---------- OVERVIEW / DASHBOARD ---------- */
router.get("/overview", getOverview);

/* ---------- SCHEDULES (slots) ---------- */
router.get("/schedules/list", listSchedules);
router.get("/schedules/:id", getScheduleById);
router.patch("/schedules/:id/toggle", toggleSchedule);

/* ---------- BOOKINGS ---------- */
router.get("/bookings/list", listBookings);
router.get("/bookings/:id", getBookingById);
router.patch("/bookings/:id/status", updateBookingStatus);

/* ---------- ACTIVITIES LIST ---------- */
router.get("/list", listActivities);
router.get("/", listActivities);

/* ---------- SINGLE ACTIVITY (sabse aakhir me) ---------- */
router.get("/:id/schedules", getActivitySchedules);
router.patch("/:id/status", updateActivityStatus);
router.patch("/:id/toggle", toggleActivity);
router.get("/:id", getActivityById);

export default router;