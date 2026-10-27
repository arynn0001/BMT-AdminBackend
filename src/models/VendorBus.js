import mongoose from "mongoose";

/**
 * Vendor panel ka Bus collection — SAME DB, SAME collection "buses"
 */

const vendorBusSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "buses", timestamps: true }
);

export const VendorBus =
  mongoose.models.VendorBus ||
  mongoose.model("VendorBus", vendorBusSchema, "buses");

/* =========================================================
   VENDOR BUS BOOKING — same DB, collection "busbookings"
   ========================================================= */

const vendorBusBookingSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "busbookings", timestamps: true }
);

export const VendorBusBooking =
  mongoose.models.VendorBusBooking ||
  mongoose.model("VendorBusBooking", vendorBusBookingSchema, "busbookings");