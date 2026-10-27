
import mongoose from "mongoose";

/**
 * Vendor panel ka Cab collection — SAME DB, SAME collection "cabs"
 * Admin panel direct read karta hai
 */

const vendorCabSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "cabs", timestamps: true }
);

export const VendorCab =
  mongoose.models.VendorCab ||
  mongoose.model("VendorCab", vendorCabSchema, "cabs");

/* =========================================================
   CAB BOOKING (vendor ka cabbookings collection)
========================================================= */

const vendorCabBookingSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "cabbookings", timestamps: true }
);

export const VendorCabBooking =
  mongoose.models.VendorCabBooking ||
  mongoose.model("VendorCabBooking", vendorCabBookingSchema, "cabbookings");