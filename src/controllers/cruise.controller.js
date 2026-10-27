import mongoose from "mongoose";
import {
  Vendor,
  CruiseShip,
  CruiseItinerary,
  CruiseSailing,
  CruiseCabin,
  CruisePricing,
  CruiseAvailability,
  CruiseBooking,
} from "../models/cruise.model.js";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
const VENDOR_SELECT =
  "name email phone companyName businessName selectedVertical vertical";

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

const serverError = (res, label, error) => {
  console.error(label, error);
  return fail(res, 500, "INTERNAL_ERROR", error.message || "Something went wrong");
};

const vendorPop = { path: "vendorId", select: VENDOR_SELECT };
const shipPop = { path: "shipId", select: "shipName cruiseLineName cruiseType coverImage" };
const sailingPop = {
  path: "sailingId",
  select: "sailingCode departureDate returnDate departurePort arrivalPort status bookingStatus",
};
const cabinPop = {
  path: "cabinId",
  select: "cabinName cabinNumber cabinType deckName maxGuests coverImage",
};

// ---------------------------------------------------------
// Resource config (ek hi generic list / detail / status logic)
// ---------------------------------------------------------
export const RESOURCES = {
  ships: {
    model: CruiseShip,
    label: "Cruise ship",
    search: ["shipName", "cruiseLineName", "imoNumber", "registrationNumber"],
    filters: ["vendorId", "status", "cruiseType"],
    populate: [vendorPop],
    sort: { createdAt: -1 },
    statuses: ["draft", "active", "inactive"],
    statusField: "status",
  },
  itineraries: {
    model: CruiseItinerary,
    label: "Cruise itinerary",
    search: ["itineraryName", "itineraryCode", "departurePort.name", "arrivalPort.name"],
    filters: ["vendorId", "shipId", "status"],
    populate: [vendorPop, shipPop],
    sort: { createdAt: -1 },
    statuses: ["draft", "active", "inactive"],
    statusField: "status",
  },
  sailings: {
    model: CruiseSailing,
    label: "Cruise sailing",
    search: ["sailingCode", "departurePort.name", "arrivalPort.name"],
    filters: ["vendorId", "shipId", "itineraryId", "status", "bookingStatus"],
    dateField: "departureDate",
    populate: [
      vendorPop,
      shipPop,
      {
        path: "itineraryId",
        select: "itineraryName itineraryCode durationDays durationNights",
      },
    ],
    sort: { departureDate: -1 },
    statuses: ["draft", "active", "inactive", "cancelled", "completed"],
    statusField: "status",
  },
  cabins: {
    model: CruiseCabin,
    label: "Cruise cabin",
    search: ["cabinName", "cabinNumber", "deckName"],
    filters: ["vendorId", "shipId", "cabinType", "status", "available"],
    populate: [vendorPop, shipPop],
    sort: { createdAt: -1 },
    statuses: ["draft", "active", "inactive"],
    statusField: "status",
  },
  pricing: {
    model: CruisePricing,
    label: "Cruise pricing",
    search: [],
    filters: ["vendorId", "sailingId", "shipId", "cabinId", "status", "currency"],
    populate: [vendorPop, sailingPop, shipPop, cabinPop],
    sort: { createdAt: -1 },
    statuses: ["draft", "active", "inactive"],
    statusField: "status",
  },
  availability: {
    model: CruiseAvailability,
    label: "Cruise availability",
    search: [],
    filters: ["vendorId", "sailingId", "shipId", "cabinId", "status"],
    populate: [vendorPop, sailingPop, shipPop, cabinPop],
    sort: { createdAt: -1 },
    // availability status auto-calculate hota hai, isliye admin se edit nahi
  },
  bookings: {
    model: CruiseBooking,
    label: "Cruise booking",
    search: ["bookingReference", "customerName", "customerEmail", "customerPhone"],
    filters: [
      "vendorId",
      "sailingId",
      "shipId",
      "cabinId",
      "customerId",
      "paymentStatus",
      "bookingStatus",
    ],
    dateField: "createdAt",
    populate: [
      vendorPop,
      sailingPop,
      shipPop,
      cabinPop,
      { path: "pricingId", select: "finalPrice adultPrice currency status" },
    ],
    sort: { createdAt: -1 },
    statuses: ["pending", "reserved", "confirmed", "cancelled", "completed"],
    statusField: "bookingStatus",
  },
};

// ---------------------------------------------------------
// Generic LIST  -> GET /admin/cruises/:resource
// Query: page, limit, search, from, to, + resource filters
// ---------------------------------------------------------
export const listResource = (key) => async (req, res) => {
  try {
    const cfg = RESOURCES[key];
    const q = req.query;

    const page = Math.max(parseInt(q.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 20, 1), 100);

    const filter = {};

    for (const f of cfg.filters) {
      if (q[f] === undefined || q[f] === "") continue;

      if (f.endsWith("Id")) {
        if (!isValidId(q[f])) {
          return fail(res, 400, "INVALID_ID", `Invalid ${f}.`);
        }
        filter[f] = q[f];
      } else if (f === "available") {
        filter[f] = String(q[f]).toLowerCase() === "true";
      } else {
        filter[f] = q[f];
      }
    }

    if (q.search && cfg.search.length) {
      const rx = new RegExp(escapeRegex(q.search.trim()), "i");
      filter.$or = cfg.search.map((field) => ({ [field]: rx }));
    }

    if (cfg.dateField && (q.from || q.to)) {
      filter[cfg.dateField] = {};
      if (q.from) filter[cfg.dateField].$gte = new Date(q.from);
      if (q.to) filter[cfg.dateField].$lte = new Date(q.to);
    }

    const [items, total] = await Promise.all([
      cfg.model
        .find(filter)
        .populate(cfg.populate)
        .sort(cfg.sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      cfg.model.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    return serverError(res, `ADMIN CRUISE LIST ${key} ERROR:`, error);
  }
};

// ---------------------------------------------------------
// Generic DETAIL -> GET /admin/cruises/:resource/:id
// ---------------------------------------------------------
export const getResourceById = (key) => async (req, res) => {
  try {
    const cfg = RESOURCES[key];

    if (!isValidId(req.params.id)) {
      return fail(res, 400, "INVALID_ID", "Invalid ID.");
    }

    const item = await cfg.model
      .findById(req.params.id)
      .populate(cfg.populate)
      .lean();

    if (!item) {
      return fail(res, 404, "NOT_FOUND", `${cfg.label} not found.`);
    }

    return res.json({ success: true, data: item });
  } catch (error) {
    return serverError(res, `ADMIN CRUISE GET ${key} ERROR:`, error);
  }
};

// ---------------------------------------------------------
// Generic STATUS UPDATE -> PATCH /admin/cruises/:resource/:id/status
// Body: { "status": "active" }  (bookings me bookingStatus)
// ---------------------------------------------------------
export const updateResourceStatus = (key) => async (req, res) => {
  try {
    const cfg = RESOURCES[key];

    if (!cfg.statuses) {
      return fail(res, 405, "NOT_ALLOWED", `${cfg.label} status cannot be changed.`);
    }

    if (!isValidId(req.params.id)) {
      return fail(res, 400, "INVALID_ID", "Invalid ID.");
    }

    const { status, reason } = req.body || {};

    if (!cfg.statuses.includes(status)) {
      return fail(
        res,
        400,
        "INVALID_STATUS",
        `Status must be one of: ${cfg.statuses.join(", ")}`
      );
    }

    const doc = await cfg.model.findById(req.params.id);

    if (!doc) {
      return fail(res, 404, "NOT_FOUND", `${cfg.label} not found.`);
    }

    const previous = doc[cfg.statusField];
    doc[cfg.statusField] = status;

    if (key === "bookings") {
      if (status === "confirmed" && !doc.confirmedAt) doc.confirmedAt = new Date();
      if (status === "completed" && !doc.completedAt) doc.completedAt = new Date();

      if (status === "cancelled") {
        doc.cancelledAt = doc.cancelledAt || new Date();
        if (reason) doc.cancellationReason = String(reason).trim();

        // reserved booking cancel hone par inventory wapas release karo
        if (previous === "reserved") {
          await CruiseAvailability.findOneAndUpdate(
            {
              sailingId: doc.sailingId,
              shipId: doc.shipId,
              cabinId: doc.cabinId,
              reservedInventory: { $gte: doc.quantity },
            },
            {
              $inc: {
                availableInventory: doc.quantity,
                reservedInventory: -doc.quantity,
              },
            }
          );
        }
      }
    }

    await doc.save();

    return res.json({
      success: true,
      message: `${cfg.label} status updated to ${status}.`,
      data: doc,
    });
  } catch (error) {
    return serverError(res, `ADMIN CRUISE STATUS ${key} ERROR:`, error);
  }
};

// ---------------------------------------------------------
// VENDORS -> GET /admin/cruises/vendors
// Cruise vendors + unke ships / sailings / bookings ka count
// ---------------------------------------------------------
export const listCruiseVendors = async (req, res) => {
  try {
    const filter = {
      $or: [
        { selectedVertical: { $regex: /^cruise$/i } },
        { vertical: { $regex: /^cruise$/i } },
      ],
    };

    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$and = [
        { $or: [{ name: rx }, { email: rx }, { phone: rx }, { companyName: rx }, { businessName: rx }] },
      ];
    }

    const vendors = await Vendor.find(filter)
      .select("-password -passwordHash -token -refreshToken")
      .sort({ createdAt: -1 })
      .lean();

    const countBy = (Model, match = {}) =>
      Model.aggregate([
        { $match: match },
        { $group: { _id: "$vendorId", count: { $sum: 1 } } },
      ]);

    const [ships, sailings, cabins, bookings] = await Promise.all([
      countBy(CruiseShip),
      countBy(CruiseSailing),
      countBy(CruiseCabin),
      countBy(CruiseBooking),
    ]);

    const toMap = (rows) =>
      Object.fromEntries(rows.map((r) => [String(r._id), r.count]));

    const shipMap = toMap(ships);
    const sailingMap = toMap(sailings);
    const cabinMap = toMap(cabins);
    const bookingMap = toMap(bookings);

    const data = vendors.map((v) => ({
      ...v,
      stats: {
        ships: shipMap[String(v._id)] || 0,
        sailings: sailingMap[String(v._id)] || 0,
        cabins: cabinMap[String(v._id)] || 0,
        bookings: bookingMap[String(v._id)] || 0,
      },
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return serverError(res, "ADMIN CRUISE VENDORS ERROR:", error);
  }
};

// ---------------------------------------------------------
// OVERVIEW -> GET /admin/cruises/overview
// Dashboard cards: live sailings, cabins available, embark today, gross value
// ---------------------------------------------------------
export const getOverview = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [
      liveSailings,
      shipIds,
      inventoryAgg,
      cabinTypeAgg,
      sailingsToday,
      grossAgg,
      pendingAgg,
      bookingStatusAgg,
      totals,
    ] = await Promise.all([
      CruiseSailing.countDocuments({ status: "active" }),
      CruiseSailing.distinct("shipId", { status: "active" }),
      CruiseAvailability.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: "$totalInventory" },
            available: { $sum: "$availableInventory" },
            reserved: { $sum: "$reservedInventory" },
            sold: { $sum: "$soldInventory" },
          },
        },
      ]),
      CruiseAvailability.aggregate([
        {
          $lookup: {
            from: CruiseCabin.collection.name,
            localField: "cabinId",
            foreignField: "_id",
            as: "cabin",
          },
        },
        { $unwind: "$cabin" },
        {
          $group: {
            _id: "$cabin.cabinType",
            open: { $sum: "$availableInventory" },
          },
        },
      ]),
      CruiseSailing.find({
        departureDate: { $gte: startOfDay, $lte: endOfDay },
      })
        .select("_id departurePort.name")
        .lean(),
      CruiseBooking.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, gross: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      CruiseBooking.aggregate([
        {
          $match: {
            paymentStatus: "pending",
            bookingStatus: { $in: ["pending", "reserved"] },
          },
        },
        { $group: { _id: null, amount: { $sum: "$totalAmount" }, count: { $sum: 1 } } },
      ]),
      CruiseBooking.aggregate([
        { $group: { _id: "$bookingStatus", count: { $sum: 1 } } },
      ]),
      Promise.all([
        CruiseShip.countDocuments(),
        CruiseItinerary.countDocuments(),
        CruiseCabin.countDocuments(),
        CruiseBooking.countDocuments(),
        Vendor.countDocuments({
          $or: [
            { selectedVertical: { $regex: /^cruise$/i } },
            { vertical: { $regex: /^cruise$/i } },
          ],
        }),
      ]),
    ]);

    // Embark today
    const todaySailingIds = sailingsToday.map((s) => s._id);
    const todayPorts = [
      ...new Set(sailingsToday.map((s) => s.departurePort?.name).filter(Boolean)),
    ];

    let embarkToday = 0;
    if (todaySailingIds.length) {
      const embarkAgg = await CruiseBooking.aggregate([
        {
          $match: {
            sailingId: { $in: todaySailingIds },
            bookingStatus: { $in: ["reserved", "confirmed"] },
          },
        },
        { $group: { _id: null, passengers: { $sum: "$quantity" } } },
      ]);
      embarkToday = embarkAgg[0]?.passengers || 0;
    }

    const inv = inventoryAgg[0] || { total: 0, available: 0, reserved: 0, sold: 0 };
    const occupancy = inv.total
      ? Math.round(((inv.reserved + inv.sold) / inv.total) * 100)
      : 0;

    const [totalShips, totalItineraries, totalCabins, totalBookings, totalVendors] = totals;

    return res.json({
      success: true,
      data: {
        liveSailings: { count: liveSailings, ships: shipIds.length },
        cabinsAvailable: { count: inv.available, occupancyPercent: occupancy },
        embarkToday: { count: embarkToday, ports: todayPorts.length, portNames: todayPorts },
        grossValue: {
          amount: grossAgg[0]?.gross || 0,
          paidBookings: grossAgg[0]?.count || 0,
        },
        pendingPayments: {
          amount: pendingAgg[0]?.amount || 0,
          bookings: pendingAgg[0]?.count || 0,
        },
        cabinInventory: Object.fromEntries(
          cabinTypeAgg.map((c) => [c._id || "other", c.open])
        ),
        inventory: inv,
        bookingsByStatus: Object.fromEntries(
          bookingStatusAgg.map((b) => [b._id || "unknown", b.count])
        ),
        totals: {
          vendors: totalVendors,
          ships: totalShips,
          itineraries: totalItineraries,
          cabins: totalCabins,
          bookings: totalBookings,
        },
      },
    });
  } catch (error) {
    return serverError(res, "ADMIN CRUISE OVERVIEW ERROR:", error);
  }
};