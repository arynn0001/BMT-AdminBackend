/**
 * Events Routes - Admin Panel (Night club events vertical)
 * Mounted at: /admin/events
 *
 * ⚠️ ORDER MATTERS — specific routes pehle, generic (/:id) sabse aakhir
 */

import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  getOverview,
  listClubs,
  getClubById,
  updateClubStatus,
  setClubPublish,
  listEvents,
  getEventById,
  updateEventStatus,
  setEventPublish,
  getEventTickets,
  getEventTables,
  getEventBookings,
  listTickets,
  toggleTicket,
  listTables,
  toggleTable,
  listTablePricing,
  toggleTablePricing,
  listBookings,
  getBookingById,
  updateBookingStatus,
} from "../controllers/events.controller.js";

const router = Router();

router.use(authenticate);

/* ---------- OVERVIEW / DASHBOARD ---------- */
router.get("/overview", getOverview);

/* ---------- NIGHT CLUBS (venues) ---------- */
router.get("/clubs/list", listClubs);
router.get("/clubs", listClubs);
router.get("/clubs/:id", getClubById);
router.patch("/clubs/:id/status", updateClubStatus);
router.patch("/clubs/:id/publish", setClubPublish);

/* ---------- TICKETS ---------- */
router.get("/tickets/list", listTickets);
router.patch("/tickets/:id/toggle", toggleTicket);

/* ---------- TABLES (club inventory) ---------- */
router.get("/tables/list", listTables);
router.patch("/tables/:id/toggle", toggleTable);

/* ---------- TABLE PRICING (event wise) ---------- */
router.get("/table-pricing/list", listTablePricing);
router.patch("/table-pricing/:id/toggle", toggleTablePricing);

/* ---------- BOOKINGS ---------- */
router.get("/bookings/list", listBookings);
router.get("/bookings/:id", getBookingById);
router.patch("/bookings/:id/status", updateBookingStatus);

/* ---------- EVENTS LIST ---------- */
router.get("/list", listEvents);
router.get("/", listEvents);

/* ---------- SINGLE EVENT (sabse aakhir me) ---------- */
router.get("/:id/tickets", getEventTickets);
router.get("/:id/tables", getEventTables);
router.get("/:id/bookings", getEventBookings);
router.patch("/:id/status", updateEventStatus);
router.patch("/:id/publish", setEventPublish);
router.get("/:id", getEventById);

export default router;