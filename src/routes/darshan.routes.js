/**
 * Darshan Routes - Admin Panel
 * Mounted at: /admin/darshan
 *
 * ⚠️ ORDER MATTERS — specific routes pehle, generic (/:id) sabse aakhir
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getOverview,
  listDarshans,
  getDarshanById,
  updateDarshanStatus,
  setDarshanPublish,
  toggleDarshan,
  getDarshanTypesOf,
  getDarshanSlotsOf,
  getDarshanAvailabilityOf,
  getDarshanBookingsOf,
  listTypes,
  getTypeById,
  toggleType,
  listSlots,
  getSlotById,
  toggleSlot,
  listAvailability,
  getAvailabilityById,
  setAvailabilityBlock,
  listBookings,
  getBookingById,
  updateBookingStatus,
} from "../controllers/darshan.controller.js";

const router = Router();

router.use(authenticate);

/* ---------- OVERVIEW / DASHBOARD ---------- */
router.get("/overview", getOverview);

/* ---------- DARSHAN TYPES ---------- */
router.get("/types/list", listTypes);
router.get("/types/:id", getTypeById);
router.patch("/types/:id/toggle", toggleType);

/* ---------- SLOTS ---------- */
router.get("/slots/list", listSlots);
router.get("/slots/:id", getSlotById);
router.patch("/slots/:id/toggle", toggleSlot);

/* ---------- AVAILABILITY (date wise) ---------- */
router.get("/availability/list", listAvailability);
router.get("/availability/:id", getAvailabilityById);
router.patch("/availability/:id/block", setAvailabilityBlock);

/* ---------- BOOKINGS ---------- */
router.get("/bookings/list", listBookings);
router.get("/bookings/:id", getBookingById);
router.patch("/bookings/:id/status", updateBookingStatus);

/* ---------- TEMPLES LIST ---------- */
router.get("/list", listDarshans);
router.get("/", listDarshans);

/* ---------- SINGLE TEMPLE (sabse aakhir me) ---------- */
router.get("/:id/types", getDarshanTypesOf);
router.get("/:id/slots", getDarshanSlotsOf);
router.get("/:id/availability", getDarshanAvailabilityOf);
router.get("/:id/bookings", getDarshanBookingsOf);
router.patch("/:id/status", updateDarshanStatus);
router.patch("/:id/publish", setDarshanPublish);
router.patch("/:id/toggle", toggleDarshan);
router.get("/:id", getDarshanById);

export default router;