/**
 * Bus Controller - Admin Panel
 */

import { VendorBus, VendorBusBooking } from "../models/VendorBus.js";
import { Bus, BusBooking } from "../models/Bus.js";
import { Vendor } from "../models/system.js";

const VENDOR_API =
  process.env.VENDOR_API_URL || "https://bmtvendorfinal.onrender.com";

/* =========================================================
   HELPER - Amount Formatter
   ========================================================= */

function formatAmount(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

/* =========================================================
   HELPER - Vendor API Call
   ========================================================= */

async function fetchFromVendor(path) {
  try {
    const res = await fetch(`${VENDOR_API}${path}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Vendor API error:", error.message);
    return null;
  }
}

/* =========================================================
   HELPER - Status Normalize
   ========================================================= */

function normalizeStatus(s) {
  if (!s) return "pending";
  const lower = String(s).toLowerCase();
  if (["pending", "approved", "rejected", "suspended"].includes(lower)) {
    return lower;
  }
  return "pending";
}

/* =========================================================
   API 1: STATS
   ========================================================= */

export const getStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tripsToday = await VendorBus.countDocuments({
    travelDate: { $gte: today, $lt: tomorrow },
    isActive: { $ne: false },
  });

  const busesWithSeats = await VendorBus.find({
    isActive: { $ne: false },
  }).lean();

  let totalSeats = 0;
  let bookedSeats = 0;
  busesWithSeats.forEach((b) => {
    totalSeats += b.totalSeats || 0;
    bookedSeats += (b.bookedSeats || []).length;
  });
  const seatOccupancy =
    totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0;
  const openSeats = totalSeats - bookedSeats;

  const crewSet = new Set();
  busesWithSeats.forEach((b) => {
    if (b.driverName) crewSet.add(b.driverName);
    if (b.helperName) crewSet.add(b.helperName);
  });
  const crewOnDuty = crewSet.size;

  // ✅ Vendor panel ke busbookings se gross value
  const grossAgg = await VendorBusBooking.aggregate([
    { $match: { bookingStatus: { $in: ["CONFIRMED", "COMPLETED"] } } },
    { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
  ]);
  const grossValue = grossAgg[0]?.total || 0;

  res.json({
    success: true,
    data: {
      tripsToday: { value: tripsToday, subValue: "92% on time" },
      seatOccupancy: {
        value: `${seatOccupancy}%`,
        numericValue: seatOccupancy,
        subValue: `${openSeats.toLocaleString()} open`,
      },
      crewOnDuty: { value: crewOnDuty, subValue: "7 offline" },
      grossValue: {
        value: formatAmount(grossValue),
        numericValue: grossValue,
        subValue: "+14.2% WoW",
      },
    },
  });
};

/* =========================================================
   API 2: LIST
   ========================================================= */

export const getList = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    status = "",
    busType = "",
    fromCity = "",
    toCity = "",
    vendorId = "",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { isActive: { $ne: false } };

  if (status && status !== "All") query.status = status;
  if (busType && busType !== "All") query.busType = busType;
  if (fromCity) query.fromCity = { $regex: fromCity, $options: "i" };
  if (toCity) query.toCity = { $regex: toCity, $options: "i" };
  if (vendorId) query.vendor = vendorId;

  if (search) {
    query.$or = [
      { busNumber: { $regex: search, $options: "i" } },
      { busName: { $regex: search, $options: "i" } },
      { operatorName: { $regex: search, $options: "i" } },
      { vendorName: { $regex: search, $options: "i" } },
      { fromCity: { $regex: search, $options: "i" } },
      { toCity: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    VendorBus.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    VendorBus.countDocuments(query),
  ]);

  const vendorIds = [...new Set(items.map((b) => b.vendor).filter(Boolean))];
  const vendors = await Vendor.find(
    { _id: { $in: vendorIds } },
    "name email businessName status vertical"
  ).lean();
  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  res.json({
    success: true,
    data: {
      items: items.map((b) => {
        const v = b.vendor ? vendorMap.get(String(b.vendor)) : null;
        return {
          id: String(b._id),
          busId: b.busId || String(b._id),
          busName: b.busName,
          busNumber: b.busNumber,
          operatorName: b.operatorName,
          vendor: v
            ? {
                id: String(v._id),
                name: v.name,
                businessName: v.businessName,
                email: v.email,
                status: v.status,
              }
            : null,
          vendorId: b.vendor ? String(b.vendor) : null,
          vendorName: b.vendorName || v?.name || "",
          busType: b.busType,
          fromCity: b.fromCity,
          toCity: b.toCity,
          departureTime: b.departureTime,
          arrivalTime: b.arrivalTime,
          totalSeats: b.totalSeats,
          availableSeats: b.availableSeats,
          price: b.price,
          status: b.status,
          currentTripStatus: b.currentTripStatus || "",
          currentDelay: b.currentDelay || 0,
          image: b.image,
          travelDate: b.travelDate,
          createdAt: b.createdAt,
        };
      }),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/* =========================================================
   API 3: SINGLE BUS
   ========================================================= */

export const getOne = async (req, res) => {
  const bus = await VendorBus.findById(req.params.id).lean();

  if (!bus) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Bus not found" },
    });
  }

  let vendor = null;
  if (bus.vendor) {
    vendor = await Vendor.findById(
      bus.vendor,
      "name email phone businessName status vertical busDetails"
    ).lean();
  }

  res.json({
    success: true,
    data: {
      id: String(bus._id),
      busId: bus.busId || String(bus._id),
      busName: bus.busName,
      busNumber: bus.busNumber,
      operatorName: bus.operatorName,
      vendor,
      vendorId: bus.vendor ? String(bus.vendor) : null,
      vendorName: bus.vendorName || vendor?.name || "",
      busType: bus.busType,
      busCategory: bus.busCategory,
      busModel: bus.busModel,
      seatLayoutType: bus.seatLayoutType,
      totalSeats: bus.totalSeats,
      availableSeats: bus.availableSeats,
      upperSeats: bus.upperSeats,
      lowerSeats: bus.lowerSeats,
      fromCity: bus.fromCity,
      toCity: bus.toCity,
      viaCities: bus.viaCities,
      routeName: bus.routeName,
      boardingPoints: bus.boardingPoints,
      droppingPoints: bus.droppingPoints,
      departureTime: bus.departureTime,
      arrivalTime: bus.arrivalTime,
      journeyDuration: bus.journeyDuration,
      reportingTime: bus.reportingTime,
      price: bus.price,
      basePrice: bus.basePrice,
      finalPrice: bus.finalPrice,
      driverName: bus.driverName,
      driverPhone: bus.driverPhone,
      helperName: bus.helperName,
      helperPhone: bus.helperPhone,
      amenities: bus.amenities,
      images: {
        main: bus.image,
        front: bus.frontImage,
        back: bus.backImage,
        seatLayout: bus.seatLayoutImage,
        inside: bus.insideImages,
        gallery: bus.gallery,
      },
      status: bus.status,
      currentTripStatus: bus.currentTripStatus || "",
      currentDelay: bus.currentDelay || 0,
      travelDate: bus.travelDate,
      createdAt: bus.createdAt,
      updatedAt: bus.updatedAt,
    },
  });
};

/* =========================================================
   API 4: LIVE DEPARTURES
   ========================================================= */

export const getLiveDepartures = async (req, res) => {
  const buses = await VendorBus.find({
    currentTripStatus: { $in: ["READY", "BOARDING", "DELAYED", "DEPARTED"] },
    isActive: { $ne: false },
  })
    .sort({ departureTime: 1 })
    .limit(10)
    .lean();

  const vendorIds = [...new Set(buses.map((b) => b.vendor).filter(Boolean))];
  const vendors = await Vendor.find(
    { _id: { $in: vendorIds } },
    "name businessName"
  ).lean();
  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  res.json({
    success: true,
    data: {
      items: buses.map((b) => {
        const v = b.vendor ? vendorMap.get(String(b.vendor)) : null;
        return {
          id: String(b._id),
          busNumber: b.busNumber,
          route: `${b.fromCity} → ${b.toCity}`,
          departureTime: b.departureTime,
          status: b.currentTripStatus,
          occupancy: b.currentOccupancy
            ? `${b.currentOccupancy}/${b.totalSeats}`
            : `0/${b.totalSeats}`,
          delay: b.currentDelay || 0,
          vendor: v?.name || b.vendorName || "",
        };
      }),
    },
  });
};

/* =========================================================
   API 5: CREW STATUS
   ========================================================= */

export const getCrewStatus = async (req, res) => {
  const buses = await VendorBus.find({ isActive: { $ne: false } }).lean();

  const crew = new Map();

  buses.forEach((b) => {
    if (b.driverName) {
      crew.set(b.driverName, {
        name: b.driverName,
        phone: b.driverPhone,
        role: "Driver",
        status: "Active",
        busNumber: b.busNumber,
      });
    }
    if (b.helperName) {
      crew.set(b.helperName, {
        name: b.helperName,
        phone: b.helperPhone,
        role: "Helper",
        status: "Active",
        busNumber: b.busNumber,
      });
    }
  });

  res.json({
    success: true,
    data: {
      total: crew.size,
      offline: 7,
      items: Array.from(crew.values()),
    },
  });
};

/* =========================================================
   API 6: VENDOR WISE STATS
   ========================================================= */

export const getVendorStats = async (req, res) => {
  const busVendors = await Vendor.find({
    vertical: "bus",
    isActive: true,
  }).lean();

  const vendorStats = [];

  for (const vendor of busVendors) {
    const busCount = await VendorBus.countDocuments({
      vendor: vendor._id,
      isActive: { $ne: false },
    });

    const pendingCount = await VendorBus.countDocuments({
      vendor: vendor._id,
      status: "pending",
      isActive: { $ne: false },
    });

    vendorStats.push({
      vendorId: String(vendor._id),
      vendorName: vendor.name,
      businessName: vendor.businessName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      totalBuses: busCount,
      pendingBuses: pendingCount,
      operatorName: vendor.busDetails?.operatorName || "",
      totalBusesInProfile: vendor.busDetails?.totalBuses || 0,
      operatingCities: vendor.busDetails?.operatingCities || [],
    });
  }

  res.json({
    success: true,
    data: {
      totalVendors: vendorStats.length,
      items: vendorStats,
    },
  });
};

/* =========================================================
   API 7: SYNC VENDORS
   ========================================================= */

export const syncFromVendor = async (req, res) => {
  const data = await fetchFromVendor("/api/vendor/auth/vendors");

  if (!data || !data.vendors) {
    return res.status(502).json({
      success: false,
      error: { code: "VENDOR_API_ERROR", message: "Vendor API not responding" },
    });
  }

  const busVendors = data.vendors.filter(
    (v) => v.vertical === "bus" || (v.services && v.services.includes("bus"))
  );

  const synced = [];
  for (const v of busVendors) {
    const existing = await Vendor.findOne({ email: v.email });
    if (existing) {
      existing.name = v.name;
      existing.businessName = v.businessName;
      existing.status = normalizeStatus(v.status);
      existing.isActive = v.isActive;
      await existing.save();
      synced.push({ action: "updated", email: v.email });
    } else {
      await Vendor.create({
        name: v.name,
        email: v.email,
        phone: v.phone,
        businessName: v.businessName,
        vertical: v.vertical || "bus",
        selectedVertical: v.selectedVertical || "bus",
        services: v.services || ["bus"],
        city: v.city,
        state: v.state,
        country: v.country,
        status: normalizeStatus(v.status),
        isApproved: v.isApproved,
        isActive: v.isActive,
        busDetails: {
          operatorName: v.businessName,
          operatingCities: v.city ? [v.city] : [],
        },
      });
      synced.push({ action: "created", email: v.email });
    }
  }

  res.json({
    success: true,
    data: {
      message: `Synced ${synced.length} bus vendors`,
      totalVendors: data.count,
      busVendorsCount: busVendors.length,
      synced,
    },
  });
};

/* =========================================================
   API 8: RECONCILE OFFLINE
   ========================================================= */

export const reconcileOfflineEvents = async (req, res) => {
  const buses = await VendorBus.find({
    currentTripStatus: "OFFLINE",
    isActive: { $ne: false },
  });

  const reconciled = [];

  for (const bus of buses) {
    bus.currentTripStatus = "READY";
    bus.currentDelay = 0;
    await bus.save();
    reconciled.push(bus.busNumber);
  }

  res.json({
    success: true,
    data: {
      message: `${reconciled.length} bus(es) reconciled`,
      reconciled,
    },
  });
};

/* =========================================================
   API 9: CREATE BUS
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  const buses = await Bus.insertMany(
    items.map((item) => ({
      ...item,
      addedBy: "admin",
      isActive: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${buses.length} bus(es) created`,
      count: buses.length,
      buses: buses.map((b) => ({
        id: String(b._id),
        busNumber: b.busNumber,
        busName: b.busName,
      })),
    },
  });
};

/* =========================================================
   API 10: UPDATE BUS
   ========================================================= */

export const update = async (req, res) => {
  const bus = await VendorBus.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!bus) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Bus not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Bus updated", bus },
  });
};

/* =========================================================
   API 11: DELETE BUS (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const bus = await VendorBus.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!bus) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Bus not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Bus removed" },
  });
};

/* =========================================================
   API 12: SYNC BUSES (fallback)
   ========================================================= */

export const syncBusesFromVendor = async (req, res) => {
  const data = await fetchFromVendor("/api/buses/search?limit=1000");

  if (!data) {
    return res.status(502).json({
      success: false,
      error: {
        code: "VENDOR_API_ERROR",
        message: "Vendor API not responding or /api/buses/search not public",
      },
    });
  }

  const vendorBuses =
    data.buses ||
    data.data?.buses ||
    data.data?.items ||
    data.items ||
    (Array.isArray(data) ? data : []);

  if (!vendorBuses.length) {
    return res.json({
      success: true,
      data: {
        message: "No buses found in vendor API",
        count: 0,
        synced: [],
      },
    });
  }

  const synced = [];
  const errors = [];

  for (const vBus of vendorBuses) {
    try {
      let adminVendorId = null;
      const vendorEmail = vBus.vendor?.email || vBus.vendorEmail;

      if (vendorEmail) {
        const adminVendor = await Vendor.findOne({ email: vendorEmail });
        if (adminVendor) adminVendorId = adminVendor._id;
      }

      const existing = vBus.busNumber
        ? await Bus.findOne({ busNumber: vBus.busNumber })
        : null;

      const payload = {
        vendor: adminVendorId,
        vendorName: vBus.vendor?.name || vBus.vendorName || "",
        vendorEmail: vBus.vendor?.email || "",
        vendorBusinessName: vBus.vendor?.businessName || "",
        busId: vBus._id ? String(vBus._id) : vBus.busId,
        busName: vBus.busName,
        busNumber: vBus.busNumber,
        operatorName: vBus.operatorName || vBus.vendor?.businessName || "",
        fromCity: vBus.fromCity,
        toCity: vBus.toCity,
        busType: vBus.busType || "AC Seater",
        totalSeats: vBus.totalSeats || 0,
        price: vBus.price || 0,
        travelDate: vBus.travelDate || new Date(),
        status: normalizeStatus(vBus.status),
        lastSyncedAt: new Date(),
      };

      if (existing) {
        Object.assign(existing, payload);
        await existing.save();
        synced.push({ action: "updated", busNumber: vBus.busNumber });
      } else {
        await Bus.create(payload);
        synced.push({ action: "created", busNumber: vBus.busNumber });
      }
    } catch (err) {
      errors.push({
        busNumber: vBus.busNumber || "unknown",
        error: err.message,
      });
    }
  }

  res.json({
    success: true,
    data: {
      message: `Synced ${synced.length} buses${
        errors.length ? `, ${errors.length} errors` : ""
      }`,
      totalFetched: vendorBuses.length,
      count: synced.length,
      synced,
      errors: errors.length ? errors : undefined,
    },
  });
};

/* =========================================================
   API 13: BOOKINGS LIST
   ========================================================= */

export const getBookings = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    bookingStatus = "",
    paymentStatus = "",
    fromCity = "",
    toCity = "",
    vendorId = "",
    busId = "",
    fromDate = "",
    toDate = "",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  if (bookingStatus && bookingStatus !== "All") {
    query.bookingStatus = bookingStatus.toUpperCase();
  }
  if (paymentStatus && paymentStatus !== "All") {
    query.paymentStatus = paymentStatus.toUpperCase();
  }
  if (fromCity) query.fromCity = { $regex: fromCity, $options: "i" };
  if (toCity) query.toCity = { $regex: toCity, $options: "i" };
  if (vendorId) query.vendor = vendorId;
  if (busId) query.bus = busId;

  if (fromDate || toDate) {
    query.travelDate = {};
    if (fromDate) query.travelDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.travelDate.$lte = end;
    }
  }

  if (search) {
    query.$or = [
      { bookingId: { $regex: search, $options: "i" } },
      { pnr: { $regex: search, $options: "i" } },
      { passengerName: { $regex: search, $options: "i" } },
      { passengerPhone: { $regex: search, $options: "i" } },
      { passengerEmail: { $regex: search, $options: "i" } },
      { fromCity: { $regex: search, $options: "i" } },
      { toCity: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    VendorBusBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    VendorBusBooking.countDocuments(query),
  ]);

  // Enrich bus + vendor
  const busIds = [...new Set(items.map((b) => b.bus).filter(Boolean))];
  const vendorIds = [...new Set(items.map((b) => b.vendor).filter(Boolean))];

  const [buses, vendors] = await Promise.all([
    VendorBus.find({ _id: { $in: busIds } }).lean(),
    Vendor.find(
      { _id: { $in: vendorIds } },
      "name email businessName phone status"
    ).lean(),
  ]);

  const busMap = new Map(buses.map((b) => [String(b._id), b]));
  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  res.json({
    success: true,
    data: {
      items: items.map((b) => {
        const bus = b.bus ? busMap.get(String(b.bus)) : null;
        const vendor = b.vendor ? vendorMap.get(String(b.vendor)) : null;

        return {
          id: String(b._id),
          bookingId: b.bookingId,
          pnr: b.pnr,

          busId: bus ? String(bus._id) : null,
          busNumber: bus?.busNumber || "",
          busName: bus?.busName || "",
          busType: bus?.busType || "",
          operatorName: bus?.operatorName || "",

          vendor: vendor
            ? {
                id: String(vendor._id),
                name: vendor.name,
                businessName: vendor.businessName,
                email: vendor.email,
                phone: vendor.phone,
                status: vendor.status,
              }
            : null,

          passengerName: b.passengerName,
          passengerPhone: b.passengerPhone,
          passengerEmail: b.passengerEmail,
          passengerAge: b.passengerAge,
          passengerGender: b.passengerGender,

          seats: b.seats || [],
          totalSeats: b.totalSeats || 0,

          fromCity: b.fromCity,
          toCity: b.toCity,
          travelDate: b.travelDate,
          boardingPoint: b.boardingPoint,
          droppingPoint: b.droppingPoint,

          pricing: {
            baseAmount: b.pricing?.baseAmount || 0,
            tax: b.pricing?.tax || 0,
            tollTax: b.pricing?.tollTax || 0,
            discount: b.pricing?.discount || 0,
            totalAmount: b.pricing?.totalAmount || 0,
            paidAmount: b.pricing?.paidAmount || 0,
          },
          totalAmount: b.pricing?.totalAmount || 0,

          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          transactionId: b.transactionId,

          bookingStatus: b.bookingStatus,
          cancelReason: b.cancelReason,

          bookedBy: b.bookedBy,
          notes: b.notes,
          isActive: b.isActive !== false,

          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      }),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/* =========================================================
   API 14: SINGLE BOOKING
   ========================================================= */

export const getBookingById = async (req, res) => {
  const booking = await VendorBusBooking.findById(req.params.id).lean();

  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Booking not found" },
    });
  }

  let bus = null;
  let vendor = null;

  if (booking.bus) bus = await VendorBus.findById(booking.bus).lean();
  if (booking.vendor) {
    vendor = await Vendor.findById(
      booking.vendor,
      "name email phone businessName status vertical"
    ).lean();
  }

  res.json({
    success: true,
    data: {
      id: String(booking._id),
      bookingId: booking.bookingId,
      pnr: booking.pnr,

      bus,
      vendor,

      passengerName: booking.passengerName,
      passengerPhone: booking.passengerPhone,
      passengerEmail: booking.passengerEmail,
      passengerAge: booking.passengerAge,
      passengerGender: booking.passengerGender,

      seats: booking.seats || [],
      totalSeats: booking.totalSeats,

      fromCity: booking.fromCity,
      toCity: booking.toCity,
      travelDate: booking.travelDate,
      boardingPoint: booking.boardingPoint,
      droppingPoint: booking.droppingPoint,

      pricing: booking.pricing,

      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      transactionId: booking.transactionId,

      bookingStatus: booking.bookingStatus,
      cancelReason: booking.cancelReason,

      bookedBy: booking.bookedBy,
      notes: booking.notes,

      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    },
  });
};

/* =========================================================
   API 15: BOOKING STATS
   ========================================================= */

export const getBookingStats = async (req, res) => {
  const total = await VendorBusBooking.countDocuments();

  const pending = await VendorBusBooking.countDocuments({
    bookingStatus: "PENDING",
  });
  const confirmed = await VendorBusBooking.countDocuments({
    bookingStatus: "CONFIRMED",
  });
  const completed = await VendorBusBooking.countDocuments({
    bookingStatus: "COMPLETED",
  });
  const cancelled = await VendorBusBooking.countDocuments({
    bookingStatus: "CANCELLED",
  });
  const noShow = await VendorBusBooking.countDocuments({
    bookingStatus: "NO_SHOW",
  });

  const revenueAgg = await VendorBusBooking.aggregate([
    {
      $match: {
        bookingStatus: { $in: ["CONFIRMED", "COMPLETED"] },
      },
    },
    { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;

  const pendingPayAgg = await VendorBusBooking.aggregate([
    { $match: { paymentStatus: "PENDING" } },
    { $group: { _id: null, total: { $sum: "$pricing.totalAmount" } } },
  ]);
  const pendingPayment = pendingPayAgg[0]?.total || 0;

  res.json({
    success: true,
    data: {
      total,
      byStatus: {
        pending,
        confirmed,
        completed,
        cancelled,
        noShow,
      },
      revenue: {
        total: totalRevenue,
        totalFormatted: formatAmount(totalRevenue),
        pendingPayment,
      },
    },
  });
};

/* =========================================================
   API 16: UPDATE BOOKING STATUS
   ========================================================= */

export const updateBookingStatus = async (req, res) => {
  const { bookingStatus, paymentStatus, notes } = req.body;

  const update = {};
  if (bookingStatus) update.bookingStatus = bookingStatus.toUpperCase();
  if (paymentStatus) update.paymentStatus = paymentStatus.toUpperCase();
  if (notes !== undefined) update.notes = notes;

  const booking = await VendorBusBooking.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Booking not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Booking updated", booking },
  });
};

/* =========================================================
   API 17: CANCEL BOOKING
   ========================================================= */

export const cancelBooking = async (req, res) => {
  const { reason } = req.body;

  const booking = await VendorBusBooking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Booking not found" },
    });
  }

  if (booking.bookingStatus === "COMPLETED") {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_STATE",
        message: "Completed booking cannot be cancelled",
      },
    });
  }

  booking.bookingStatus = "CANCELLED";
  booking.cancelReason = reason || "Cancelled by admin";

  await booking.save();

  res.json({
    success: true,
    data: { message: "Booking cancelled", booking },
  });
};