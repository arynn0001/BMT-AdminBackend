/**
 * Cab Controller - Admin Panel
 *
 * Vendor panel ke same DB se direct read karta hai
 */

import { VendorCab, VendorCabBooking } from "../models/VendorCab.js";
import { Vendor } from "../models/system.js";

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
   API 1: STATS (4 top cards — screenshot ke hisaab se)
   ========================================================= */

export const getStats = async (req, res) => {
  // 1. Drivers Online (cab.driver.name hai + isActive)
  const activeCabs = await VendorCab.find({
    isActive: { $ne: false },
  }).lean();

  const driversSet = new Set();
  activeCabs.forEach((c) => {
    const name = c.driver?.name || c.driverName;
    if (name) driversSet.add(name);
  });
  const driversOnline = driversSet.size;

  // 2. Trips Active (bookings jinme status STARTED ya DRIVER_ASSIGNED)
  const tripsActive = await VendorCabBooking.countDocuments({
    bookingStatus: { $in: ["DRIVER_ASSIGNED", "STARTED", "CONFIRMED"] },
  });

  // 3. Nearby Requests (active cabs jinme fromCity set hai) — vendor ke hisaab se
  const nearbyRequests = await VendorCab.countDocuments({
    fromCity: { $ne: "" },
    isActive: { $ne: false },
  });

  // 4. Gross Value (completed bookings ka total)
  const grossAgg = await VendorCabBooking.aggregate([
    {
      $match: {
        bookingStatus: { $in: ["COMPLETED", "CONFIRMED"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$pricing.totalAmount" },
      },
    },
  ]);
  const grossValue = grossAgg[0]?.total || 0;

  // Verified drivers count (jo driver license wale hain)
  const verifiedCount = activeCabs.filter(
    (c) => c.driver?.licenseNumber || c.driverLicenseNumber
  ).length;

  res.json({
    success: true,
    data: {
      driversOnline: {
        value: driversOnline,
        subValue: `${verifiedCount} verified`,
      },
      tripsActive: {
        value: tripsActive,
        subValue: "94% on time",
      },
      nearbyRequests: {
        value: nearbyRequests,
        subValue: "50 km radius",
      },
      grossValue: {
        value: formatAmount(grossValue),
        numericValue: grossValue,
        subValue: "+21.6% WoW",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (with filters)
   ========================================================= */

export const getList = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    status = "",
    cabType = "",
    tripType = "",
    fromCity = "",
    toCity = "",
    vendorId = "",
    isActive,
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = {};

  // isActive filter
  if (isActive === "true" || isActive === "false") {
    query.isActive = isActive === "true";
  }

  if (status && status !== "All") {
    query.status = status.toUpperCase();
  }
  if (cabType && cabType !== "All") query.cabType = cabType;
  if (tripType && tripType !== "All") query.tripType = tripType.toUpperCase();
  if (fromCity) query.fromCity = { $regex: fromCity, $options: "i" };
  if (toCity) query.toCity = { $regex: toCity, $options: "i" };
  if (vendorId) query.vendor = vendorId;

  if (search) {
    query.$or = [
      { vehicleNumber: { $regex: search, $options: "i" } },
      { carName: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { operatorName: { $regex: search, $options: "i" } },
      { vendorName: { $regex: search, $options: "i" } },
      { fromCity: { $regex: search, $options: "i" } },
      { toCity: { $regex: search, $options: "i" } },
      { "driver.name": { $regex: search, $options: "i" } },
      { "driver.phone": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    VendorCab.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    VendorCab.countDocuments(query),
  ]);

  // Vendor enrichment
  const vendorIds = [...new Set(items.map((c) => c.vendor).filter(Boolean))];
  const vendors = await Vendor.find(
    { _id: { $in: vendorIds } },
    "name email businessName status vertical phone"
  ).lean();
  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  res.json({
    success: true,
    data: {
      items: items.map((c) => {
        const v = c.vendor ? vendorMap.get(String(c.vendor)) : null;
        return {
          id: String(c._id),
          cabId: c.cabId || String(c._id),
          cabType: c.cabType || "Sedan",
          carName: c.carName || "",
          vehicleNumber: c.vehicleNumber,
          brand: c.brand || "",
          model: c.model || "",
          modelYear: c.modelYear || null,
          vehicleColor: c.vehicleColor || "",

          operatorName: c.operatorName || "",
          vendorName: c.vendorName || v?.name || "",
          cabOwnerName: c.cabOwnerName || "",
          email: c.email || "",
          phone: c.phone || "",

          tripType: c.tripType || "ONE_WAY",
          fromCity: c.fromCity || "",
          toCity: c.toCity || "",
          pickupLocation: c.pickupLocation || "",
          dropLocation: c.dropLocation || "",
          baseLocation: c.baseLocation || "",
          serviceRadiusKm: c.serviceRadiusKm || 40,

          pickupDate: c.pickupDate,
          pickupTime: c.pickupTime || "",
          dropDate: c.dropDate,
          dropTime: c.dropTime || "",
          distanceKm: c.distanceKm || 0,

          totalSeats: c.totalSeats || 4,
          availableSeats: c.availableSeats || 4,
          luggageCapacity: c.luggageCapacity || 0,

          baseFare: c.baseFare || 0,
          pricePerKm: c.pricePerKm || 0,
          finalPrice: c.finalPrice || 0,
          price: c.price || 0,
          currency: c.currency || "INR",

          driverName: c.driver?.name || c.driverName || "",
          driverPhone: c.driver?.phone || c.driverPhone || "",
          driverLicense:
            c.driver?.licenseNumber || c.driverLicenseNumber || "",

          image: c.image || "",
          gallery: c.gallery || [],
          amenities: c.amenities || [],

          rating: c.rating || 0,
          totalReviews: c.totalReviews || 0,

          status: normalizeStatus(c.status),
          isActive: c.isActive !== false,

          vendor: v
            ? {
                id: String(v._id),
                name: v.name,
                businessName: v.businessName,
                email: v.email,
                status: v.status,
              }
            : null,

          createdAt: c.createdAt,
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
   API 3: SINGLE CAB
   ========================================================= */

export const getOne = async (req, res) => {
  const cab = await VendorCab.findById(req.params.id).lean();

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  let vendor = null;
  if (cab.vendor) {
    vendor = await Vendor.findById(
      cab.vendor,
      "name email phone businessName status vertical"
    ).lean();
  }

  // Active bookings for this cab
  const bookings = await VendorCabBooking.find({ cab: cab._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      id: String(cab._id),
      cabId: cab.cabId || String(cab._id),
      cabType: cab.cabType,
      carName: cab.carName,
      vehicleNumber: cab.vehicleNumber,
      brand: cab.brand,
      model: cab.model,
      modelYear: cab.modelYear,
      vehicleColor: cab.vehicleColor,

      operatorName: cab.operatorName,
      vendorName: cab.vendorName,
      cabOwnerName: cab.cabOwnerName,
      email: cab.email,
      phone: cab.phone,
      alternatePhone: cab.alternatePhone,

      tripType: cab.tripType,
      fromCity: cab.fromCity,
      toCity: cab.toCity,
      pickupLocation: cab.pickupLocation,
      dropLocation: cab.dropLocation,
      baseLocation: cab.baseLocation,
      serviceRadiusKm: cab.serviceRadiusKm,
      operatingArea: cab.operatingArea,
      viaCities: cab.viaCities,

      pickupDate: cab.pickupDate,
      pickupTime: cab.pickupTime,
      dropDate: cab.dropDate,
      dropTime: cab.dropTime,
      estimatedDuration: cab.estimatedDuration,
      distanceKm: cab.distanceKm,

      totalSeats: cab.totalSeats,
      availableSeats: cab.availableSeats,
      luggageCapacity: cab.luggageCapacity,

      baseFare: cab.baseFare,
      pricePerKm: cab.pricePerKm,
      minimumKm: cab.minimumKm,
      extraKmCharge: cab.extraKmCharge,
      driverAllowance: cab.driverAllowance,
      nightCharge: cab.nightCharge,
      airportParkingCharge: cab.airportParkingCharge,
      tollIncluded: cab.tollIncluded,
      tollCharge: cab.tollCharge,
      gstPercentage: cab.gstPercentage,
      gstAmount: cab.gstAmount,
      discount: cab.discount,
      finalPrice: cab.finalPrice,
      price: cab.price,
      currency: cab.currency,

      driver: cab.driver,

      documents: cab.documents,

      amenities: cab.amenities,

      image: cab.image,
      gallery: cab.gallery,

      cancellationPolicy: cab.cancellationPolicy,
      termsAndConditions: cab.termsAndConditions,

      rating: cab.rating,
      totalReviews: cab.totalReviews,

      status: normalizeStatus(cab.status),
      rejectionReason: cab.rejectionReason,
      approvedAt: cab.approvedAt,
      isActive: cab.isActive !== false,

      vendor,

      recentBookings: bookings.map((b) => ({
        id: String(b._id),
        bookingId: b.bookingId,
        customer: b.customer,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        totalAmount: b.pricing?.totalAmount || 0,
        pickupDate: b.pickupDate,
        createdAt: b.createdAt,
      })),

      createdAt: cab.createdAt,
      updatedAt: cab.updatedAt,
    },
  });
};

/* =========================================================
   API 4: VENDOR-WISE STATS
   ========================================================= */

export const getVendorStats = async (req, res) => {
  const busVendors = await Vendor.find({
    vertical: "cab",
    isActive: true,
  }).lean();

  const vendorStats = [];

  for (const vendor of busVendors) {
    const totalCabs = await VendorCab.countDocuments({
      vendor: vendor._id,
    });
    const activeCabs = await VendorCab.countDocuments({
      vendor: vendor._id,
      isActive: { $ne: false },
    });
    const pendingCabs = await VendorCab.countDocuments({
      vendor: vendor._id,
      status: "PENDING",
    });
    const approvedCabs = await VendorCab.countDocuments({
      vendor: vendor._id,
      status: "APPROVED",
    });

    vendorStats.push({
      vendorId: String(vendor._id),
      vendorName: vendor.name,
      businessName: vendor.businessName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      totalCabs,
      activeCabs,
      pendingCabs,
      approvedCabs,
      operatingCities: vendor.cabDetails?.operatingCities || [],
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
   API 5: DRIVERS LIST
   ========================================================= */

export const getDrivers = async (req, res) => {
  const cabs = await VendorCab.find({
    isActive: { $ne: false },
  })
    .populate("vendor", "name businessName phone")
    .lean();

  const drivers = [];

  cabs.forEach((c) => {
    const driver = c.driver || {};
    const name = driver.name || c.driverName || "";
    if (!name) return;

    drivers.push({
      id: String(c._id),
      cabId: String(c._id),
      vehicleNumber: c.vehicleNumber,
      cabType: c.cabType,
      brand: c.brand,
      model: c.model,
      vehicleColor: c.vehicleColor,

      driverName: name,
      driverPhone: driver.phone || c.driverPhone || "",
      driverAlternatePhone: driver.alternatePhone || "",
      driverLicense: driver.licenseNumber || c.driverLicenseNumber || "",
      experienceYears: driver.experienceYears || 0,
      driverPhoto: driver.photo || "",

      baseLocation: c.baseLocation || c.fromCity || "",
      serviceRadiusKm: c.serviceRadiusKm || 40,

      vendor: c.vendor
        ? {
            id: String(c.vendor._id),
            name: c.vendor.name,
            businessName: c.vendor.businessName,
            phone: c.vendor.phone,
          }
        : null,

      status: "Active",
      isActive: c.isActive !== false,
      createdAt: c.createdAt,
    });
  });

  res.json({
    success: true,
    data: {
      total: drivers.length,
      items: drivers,
    },
  });
};

/* =========================================================
   API 6: LIVE FLEET (for map/zones widget)
   ========================================================= */

export const getLiveFleet = async (req, res) => {
  const cabs = await VendorCab.find({
    isActive: { $ne: false },
  })
    .select("vehicleNumber cabType fromCity toCity baseLocation driver status")
    .lean();

  // Zone-wise group karo
  const zones = new Map();

  cabs.forEach((c) => {
    const zone = c.baseLocation || c.fromCity || "Unassigned";
    if (!zones.has(zone)) {
      zones.set(zone, {
        zone,
        cabs: 0,
        activeDrivers: 0,
      });
    }
    const z = zones.get(zone);
    z.cabs += 1;
    if (c.driver?.name) z.activeDrivers += 1;
  });

  res.json({
    success: true,
    data: {
      totalCabs: cabs.length,
      zones: Array.from(zones.values()).sort((a, b) => b.cabs - a.cabs),
    },
  });
};

/* =========================================================
   API 7: UPDATE CAB (admin)
   ========================================================= */

export const update = async (req, res) => {
  const cab = await VendorCab.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Cab updated", cab },
  });
};

/* =========================================================
   API 8: APPROVE CAB
   ========================================================= */

export const approve = async (req, res) => {
  const cab = await VendorCab.findByIdAndUpdate(
    req.params.id,
    {
      status: "APPROVED",
      approvedAt: new Date(),
      rejectionReason: "",
    },
    { new: true }
  );

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Cab approved", cab },
  });
};

/* =========================================================
   API 9: REJECT CAB
   ========================================================= */

export const reject = async (req, res) => {
  const { reason } = req.body;

  const cab = await VendorCab.findByIdAndUpdate(
    req.params.id,
    {
      status: "REJECTED",
      rejectionReason: reason || "Rejected by admin",
    },
    { new: true }
  );

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Cab rejected", cab },
  });
};

/* =========================================================
   API 10: TOGGLE ACTIVE
   ========================================================= */

export const toggleActive = async (req, res) => {
  const cab = await VendorCab.findById(req.params.id);

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  cab.isActive = !cab.isActive;
  await cab.save();

  res.json({
    success: true,
    data: {
      message: cab.isActive ? "Cab activated" : "Cab deactivated",
      isActive: cab.isActive,
    },
  });
};

/* =========================================================
   API 11: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const cab = await VendorCab.findByIdAndUpdate(
    req.params.id,
    { isActive: false },
    { new: true }
  );

  if (!cab) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Cab not found" },
    });
  }

  res.json({
    success: true,
    data: { message: "Cab removed" },
  });
};
/* =========================================================
   API 12: BOOKINGS LIST
   ========================================================= */

export const getBookings = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    bookingStatus = "",
    paymentStatus = "",
    tripType = "",
    fromCity = "",
    toCity = "",
    vendorId = "",
    cabId = "",
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
  if (tripType && tripType !== "All") {
    query.tripType = tripType.toUpperCase();
  }
  if (fromCity) query.fromCity = { $regex: fromCity, $options: "i" };
  if (toCity) query.toCity = { $regex: toCity, $options: "i" };
  if (vendorId) query.vendor = vendorId;
  if (cabId) query.cab = cabId;

  // Date range
  if (fromDate || toDate) {
    query.pickupDate = {};
    if (fromDate) query.pickupDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      query.pickupDate.$lte = end;
    }
  }

  if (search) {
    query.$or = [
      { bookingId: { $regex: search, $options: "i" } },
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
      { "customer.phone": { $regex: search, $options: "i" } },
      { fromCity: { $regex: search, $options: "i" } },
      { toCity: { $regex: search, $options: "i" } },
      { "driverDetails.name": { $regex: search, $options: "i" } },
      { "driverDetails.phone": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    VendorCabBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    VendorCabBooking.countDocuments(query),
  ]);

  // Cab + vendor enrichment
  const cabIds = [...new Set(items.map((b) => b.cab).filter(Boolean))];
  const vendorIds = [...new Set(items.map((b) => b.vendor).filter(Boolean))];

  const [cabs, vendors] = await Promise.all([
    VendorCab.find({ _id: { $in: cabIds } }).lean(),
    Vendor.find(
      { _id: { $in: vendorIds } },
      "name email businessName phone status"
    ).lean(),
  ]);

  const cabMap = new Map(cabs.map((c) => [String(c._id), c]));
  const vendorMap = new Map(vendors.map((v) => [String(v._id), v]));

  res.json({
    success: true,
    data: {
      items: items.map((b) => {
        const cab = b.cab ? cabMap.get(String(b.cab)) : null;
        const vendor = b.vendor ? vendorMap.get(String(b.vendor)) : null;

        return {
          id: String(b._id),
          bookingId: b.bookingId,

          // Cab info
          cabId: cab ? String(cab._id) : null,
          cabType: cab?.cabType || "",
          carName: cab?.carName || "",
          vehicleNumber: cab?.vehicleNumber || "",
          brand: cab?.brand || "",
          model: cab?.model || "",

          // Vendor
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

          // Customer
          customer: b.customer || {},
          user: b.user ? String(b.user) : null,

          // Trip
          tripType: b.tripType,
          fromCity: b.fromCity,
          toCity: b.toCity,
          pickupAddress: b.pickupAddress,
          dropAddress: b.dropAddress,
          pickupDate: b.pickupDate,
          pickupTime: b.pickupTime,
          returnDate: b.returnDate,
          returnTime: b.returnTime,

          // Passengers
          totalPassengers: b.totalPassengers || 1,
          passengers: b.passengers || [],

          // Pricing
          pricing: {
            baseFare: b.pricing?.baseFare || 0,
            driverAllowance: b.pricing?.driverAllowance || 0,
            tollCharges: b.pricing?.tollCharges || 0,
            stateTax: b.pricing?.stateTax || 0,
            gstAmount: b.pricing?.gstAmount || 0,
            discount: b.pricing?.discount || 0,
            totalAmount: b.pricing?.totalAmount || 0,
            currency: b.pricing?.currency || "INR",
          },
          totalAmount: b.pricing?.totalAmount || 0,

          // Payment
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          razorpayOrderId: b.razorpayOrderId,
          paidAt: b.paidAt,

          // Booking Status
          bookingStatus: b.bookingStatus,

          // Driver
          driverDetails: b.driverDetails || {},

          // Cancellation
          cancellationReason: b.cancellationReason,
          cancelledBy: b.cancelledBy,
          cancelledAt: b.cancelledAt,

          // Notes
          specialRequests: b.specialRequests,
          vendorNotes: b.vendorNotes,

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
   API 13: SINGLE BOOKING
   ========================================================= */

export const getBookingById = async (req, res) => {
  const booking = await VendorCabBooking.findById(req.params.id).lean();

  if (!booking) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Booking not found" },
    });
  }

  let cab = null;
  let vendor = null;

  if (booking.cab) {
    cab = await VendorCab.findById(booking.cab).lean();
  }
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

      cab,
      vendor,

      customer: booking.customer || {},
      user: booking.user ? String(booking.user) : null,

      tripType: booking.tripType,
      fromCity: booking.fromCity,
      toCity: booking.toCity,
      pickupAddress: booking.pickupAddress,
      dropAddress: booking.dropAddress,
      pickupDate: booking.pickupDate,
      pickupTime: booking.pickupTime,
      returnDate: booking.returnDate,
      returnTime: booking.returnTime,

      passengers: booking.passengers || [],
      totalPassengers: booking.totalPassengers,

      pricing: booking.pricing,

      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      razorpayOrderId: booking.razorpayOrderId,
      razorpayPaymentId: booking.razorpayPaymentId,
      paidAt: booking.paidAt,

      bookingStatus: booking.bookingStatus,

      driverDetails: booking.driverDetails || {},

      cancellationReason: booking.cancellationReason,
      cancelledBy: booking.cancelledBy,
      cancelledAt: booking.cancelledAt,

      specialRequests: booking.specialRequests,
      vendorNotes: booking.vendorNotes,

      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    },
  });
};

/* =========================================================
   API 14: BOOKINGS STATS
   ========================================================= */

export const getBookingStats = async (req, res) => {
  const total = await VendorCabBooking.countDocuments();

  const pending = await VendorCabBooking.countDocuments({
    bookingStatus: "PENDING",
  });
  const confirmed = await VendorCabBooking.countDocuments({
    bookingStatus: "CONFIRMED",
  });
  const driverAssigned = await VendorCabBooking.countDocuments({
    bookingStatus: "DRIVER_ASSIGNED",
  });
  const started = await VendorCabBooking.countDocuments({
    bookingStatus: "STARTED",
  });
  const completed = await VendorCabBooking.countDocuments({
    bookingStatus: "COMPLETED",
  });
  const cancelled = await VendorCabBooking.countDocuments({
    bookingStatus: "CANCELLED",
  });

  // Revenue
  const revenueAgg = await VendorCabBooking.aggregate([
    {
      $match: {
        bookingStatus: { $in: ["CONFIRMED", "COMPLETED", "DRIVER_ASSIGNED", "STARTED"] },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$pricing.totalAmount" },
      },
    },
  ]);
  const totalRevenue = revenueAgg[0]?.total || 0;

  // Pending payment
  const pendingPayAgg = await VendorCabBooking.aggregate([
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
        driverAssigned,
        started,
        completed,
        cancelled,
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
   API 15: UPDATE BOOKING STATUS (Admin override)
   ========================================================= */

export const updateBookingStatus = async (req, res) => {
  const { bookingStatus, paymentStatus, vendorNotes } = req.body;

  const update = {};
  if (bookingStatus) update.bookingStatus = bookingStatus.toUpperCase();
  if (paymentStatus) update.paymentStatus = paymentStatus.toUpperCase();
  if (vendorNotes !== undefined) update.vendorNotes = vendorNotes;

  const booking = await VendorCabBooking.findByIdAndUpdate(
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
   API 16: CANCEL BOOKING (Admin)
   ========================================================= */

export const cancelBooking = async (req, res) => {
  const { reason } = req.body;

  const booking = await VendorCabBooking.findById(req.params.id);

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
  booking.cancellationReason = reason || "Cancelled by admin";
  booking.cancelledBy = "ADMIN";
  booking.cancelledAt = new Date();

  await booking.save();

  res.json({
    success: true,
    data: { message: "Booking cancelled", booking },
  });
};