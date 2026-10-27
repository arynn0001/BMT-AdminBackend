/**
 * Stays Routes (Admin)
 *
 * Mounted at:  /admin/stays   (server.js me)
 *
 * Vendor ka sara Stays data (Hotel, Motel, Homestay, Apartment, Villa,
 * Palace, Resort, BnB) yahin se admin ko milta hai.
 */

import { Router } from "express";
import * as stays from "../controllers/Stays.controller.js";

// ---------------------------------------------------------------
// AUTH: apne baaki admin routes me jo auth middleware use ho raha hai
// (jaise bus.routes.js me) vahi yahan lagao. Example:
//
//   import { authenticate, requireAdmin } from "../middleware/auth.js";
//   router.use(authenticate, requireAdmin);
//
// Jab tak ye nahi lagaoge, ye endpoints public rahenge.
// ---------------------------------------------------------------

const router = Router();

/* ---------- Overview / config ---------- */
router.get("/meta", stays.getMeta);
router.get("/dashboard", stays.getDashboard);

/* ---------- Properties (all 8 types, unified) ---------- */
// GET /admin/stays/properties?type=hotel,palace&status=PENDING&q=lake&city=Udaipur&page=1&limit=20
router.get("/properties", stays.listProperties);

// GET /admin/stays/properties/:type/:id      (type = hotel|motel|homestay|apartment|villa|palace|resort|bnb)
router.get("/properties/:type/:id", stays.getPropertyDetail);

// Approval workflow
router.patch("/properties/:type/:id/status", stays.changeStatus); // body: { action, reason? }
router.patch("/properties/:type/:id/approve", stays.approveProperty);
router.patch("/properties/:type/:id/reject", stays.rejectProperty); // body: { reason }
router.patch("/properties/:type/:id/suspend", stays.suspendProperty); // body: { reason? }
router.patch("/properties/:type/:id/reactivate", stays.reactivateProperty);
router.patch("/properties/:type/:id/feature", stays.setFeatured); // body: { featured }

/* ---------- Rooms, rates, inventory ---------- */
router.get("/rooms", stays.listRooms); // ?type=&propertyId=&status=
router.get("/rates", stays.listRatePlans); // ?type=palace|resort|apartment&propertyId=
router.get("/inventory", stays.listInventory); // ?type=&propertyId=&from=&to=
router.get("/overbooking", stays.listOverbooking);

/* ---------- Reservations ---------- */
// GET /admin/stays/bookings?type=hotel&status=CONFIRMED&paymentStatus=PAID&from=2026-10-01&to=2026-10-31&q=
router.get("/bookings", stays.listBookings);
router.get("/bookings/:type/:id", stays.getBookingDetail);

/* ---------- Reviews (homestay + resort) ---------- */
router.get("/reviews", stays.listReviews);
router.patch("/reviews/:type/:id", stays.moderateReview); // body: { status, reason? }

/* ---------- Vendors ---------- */
router.get("/vendor-applications", stays.listVendorApplications);
router.get("/vendors", stays.listVendors);
router.get("/vendors/:vendorId", stays.getVendorDetail);
router.get("/motel-operators", stays.listMotelOperators);

/* ---------- Payments & payouts ---------- */
router.get("/payouts", stays.getPayouts);

export default router;