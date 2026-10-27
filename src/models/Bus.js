/**
 * Bus Model - Admin Panel
 */

import mongoose from "mongoose";

/* =========================================================
   BUS SCHEMA
   ========================================================= */

const busSchema = new mongoose.Schema(
  {
    /* ================= VENDOR REF ================= */
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: false,   // ← CHANGE (pehle true tha)
      index: true,
    },
    vendorName: String,
    vendorEmail: String,
    vendorBusinessName: String,

    /* ================= BASIC INFO ================= */
    busId: { type: String, index: true },
    busName: { type: String, required: true },
    busNumber: { type: String, required: true, unique: true, index: true },
    operatorName: String,
    busOwner: String,

    /* ================= OPERATOR CONTACT ================= */
    email: String,
    phone: String,
    altPhone: String,
    address: String,
    city: String,
    state: String,
    country: { type: String, default: "India" },

    /* ================= ROUTE INFO ================= */
    fromCity: { type: String, required: true, index: true },
    toCity: { type: String, required: true, index: true },
    viaCities: [String],
    routeName: String,

    /* ================= BOARDING POINTS ================= */
    boardingPoints: [
      {
        location: String,
        time: String,
        address: String,
        landmark: String,
      },
    ],

    /* ================= DROPPING POINTS ================= */
    droppingPoints: [
      {
        location: String,
        time: String,
        address: String,
        landmark: String,
      },
    ],

    /* ================= TIMING ================= */
    departureTime: String,
    arrivalTime: String,
    journeyDuration: String,
    reportingTime: String,

    /* ================= BUS DETAILS ================= */
    busType: {
      type: String,
      enum: ["AC", "Non-AC", "Sleeper", "Seater", "AC Sleeper", "AC Seater"],
      required: false,   // ← CHANGE (pehle true tha)
      index: true,
      default: "AC Seater",
    },
    busCategory: String,
    busModel: String,
    busColor: String,
    seatLayoutType: String,
    totalSeats: { type: Number, default: 0 },   // ← CHANGE (required tha)
    availableSeats: { type: Number, default: 0 },
    upperSeats: { type: Number, default: 0 },
    lowerSeats: { type: Number, default: 0 },

    /* ================= SEAT SYSTEM ================= */
    seatNumbers: [String],
    bookedSeats: [String],
    blockedSeats: [String],
    seatPrice: [
      {
        seatNo: String,
        price: String,
      },
    ],

    /* ================= PRICING ================= */
    basePrice: String,
    tax: String,
    tollTax: String,
    discount: String,
    offerPrice: String,
    finalPrice: String,
    price: { type: Number, default: 0 },   // ← CHANGE (required tha)
    agentCommission: String,
    agentPrice: String,
    vendorCost: String,
    vendorPaymentStatus: String,
    profit: String,

    /* ================= DRIVER ================= */
    driverName: String,
    driverPhone: String,
    driverLicense: String,
    helperName: String,
    helperPhone: String,

    /* ================= DOCUMENTS ================= */
    rcNumber: String,
    insuranceNumber: String,
    permitNumber: String,
    fitnessExpiry: String,

    /* ================= LIVE TRACK ================= */
    gpsDeviceId: String,
    liveTrackingLink: String,
    busCurrentLocation: String,

    /* ================= AMENITIES ================= */
    amenities: [String],

    /* ================= DATES ================= */
    travelDate: { type: Date, default: Date.now, index: true },   // ← CHANGE (required tha)
    returnDate: Date,
    startBookingDate: Date,
    endBookingDate: Date,
    cancelDate: Date,
    completedDate: Date,
    modifiedDate: Date,

    /* ================= MAP ================= */
    routeMap: {
      fromLat: String,
      fromLng: String,
      toLat: String,
      toLng: String,
    },

    /* ================= IMAGES ================= */
    frontImage: String,
    backImage: String,
    seatLayoutImage: String,
    insideImages: [String],
    image: String,
    gallery: [
      {
        public_id: String,
        url: String,
      },
    ],

    /* ================= POLICY ================= */
    cancellationPolicy: String,
    rating: String,
    reviews: String,

    /* ================= STATUS ================= */
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "approved", "rejected"],
      index: true,
    },

    /* ================= ADMIN ================= */
    assignUser: String,
    notes: String,
    addedBy: { type: String, default: "vendor" },

    /* ================= OPERATIONAL ================= */
    currentTripStatus: {
      type: String,
      enum: ["READY", "BOARDING", "DELAYED", "DEPARTED", "ARRIVED", "OFFLINE", ""],
      default: "",
      index: true,
    },
    currentDelay: { type: Number, default: 0 },
    currentOccupancy: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    /* ================= VENDOR SYNC META ================= */
    vendorBusId: { type: String, index: true },   // ← NAYA (vendor ka _id)
    lastSyncedAt: Date,                            // ← NAYA
  },
  { timestamps: true, strict: false }
);

busSchema.index({ vendor: 1, status: 1 });
busSchema.index({ fromCity: 1, toCity: 1, travelDate: 1 });
busSchema.index({ currentTripStatus: 1 });

export const Bus = mongoose.model("Bus", busSchema);

/* =========================================================
   BUS BOOKING SCHEMA
   ========================================================= */

const busBookingSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    bookingId: { type: String, index: true },
    pnr: { type: String, index: true },

    passengerName: String,
    passengerPhone: String,
    passengerEmail: String,
    passengerAge: Number,
    passengerGender: String,

    seats: [String],
    totalSeats: { type: Number, default: 0 },

    fromCity: String,
    toCity: String,
    travelDate: { type: Date, index: true },
    boardingPoint: String,
    droppingPoint: String,

    pricing: {
      baseAmount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      tollTax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      totalAmount: { type: Number, default: 0 },
      paidAmount: { type: Number, default: 0 },
    },

    paymentMethod: String,
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "REFUNDED", "PARTIAL"],
      default: "PENDING",
      index: true,
    },
    transactionId: String,

    bookingStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
      default: "PENDING",
      index: true,
    },
    cancelReason: String,

    bookedBy: {
      type: String,
      enum: ["user", "admin", "vendor", "agent"],
      default: "user",
    },
    notes: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, strict: false }
);

busBookingSchema.index({ bus: 1, bookingStatus: 1 });
busBookingSchema.index({ travelDate: 1, bookingStatus: 1 });
busBookingSchema.index({ vendor: 1, bookingStatus: 1 });

export const BusBooking = mongoose.model("BusBooking", busBookingSchema);