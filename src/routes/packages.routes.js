/**
 * Packages Routes - Admin Panel
 * Mounted at: /admin/packages
 *
 * ⚠️ ORDER MATTERS — specific routes pehle, generic (/:id) sabse aakhir
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getOverview,
  listPackages,
  getPackageById,
  updatePackageStatus,
  getPackageBookings,
  listBookings,
  getBookingById,
  updateBookingStatus,
} from "../controllers/packages.controller.js";

const router = Router();

router.use(authenticate);

/* ---------- OVERVIEW / DASHBOARD ---------- */
router.get("/overview", getOverview);

/* ---------- BOOKINGS (specific routes pehle) ---------- */
router.get("/bookings/list", listBookings);
router.get("/bookings", listBookings); // alias, dono chalenge
router.get("/bookings/:id", getBookingById);
router.patch("/bookings/:id/status", updateBookingStatus);

/* ---------- PACKAGES LIST ---------- */
router.get("/", listPackages);

/* ---------- SINGLE PACKAGE (sabse aakhir me) ---------- */
router.get("/:id/bookings", getPackageBookings);
router.patch("/:id/status", updatePackageStatus);
router.get("/:id", getPackageById);

export default router;