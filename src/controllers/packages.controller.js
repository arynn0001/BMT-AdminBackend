/**
 * Packages Controller (Admin)
 * Vendor ke Tours: overview, list/detail/approve-reject, bookings list/detail/status.
 */
import mongoose from "mongoose";
import {
  Tour,
  TourBooking,
  TOUR_STATUSES,
  BOOKING_STATUSES,
} from "../models/packages.model.js";

/* ================= HELPERS ================= */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("Packages Controller Error:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
};

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error: { code, message } });

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" in IST
const istKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
// IST midnight of given date
const istStartOfDay = (d) => new Date(`${istKey(d)}T00:00:00+05:30`);

const pageParams = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const VENDOR_FIELDS = "name email phone companyName businessName";

/* Vendor ki images "/uploads/tours/x.jpg" hoti hain -> full URL banao */
const VENDOR_BASE_URL = (process.env.VENDOR_BASE_URL || "").replace(/\/+$/, "");
const absUrl = (img) => {
  if (typeof img !== "string" || !img) return img;
  if (/^https?:\/\//i.test(img)) return img;
  return `${VENDOR_BASE_URL}${img.startsWith("/") ? "" : "/"}${img}`;
};

/* Tour ko admin frontend ke liye shape karo */
const shapeTour = (t) => {
  if (!t) return t;
  const images = (t.images || []).map(absUrl);
  const vendorPopulated = t.vendorId && typeof t.vendorId === "object" && !mongoose.isValidObjectId(t.vendorId) === false
    ? t.vendorId
    : t.vendorId;
  return {
    ...t,
    images,
    bannerImage: images[0] || null,
    vendor: vendorPopulated,
  };
};

/* ================= OVERVIEW (Dashboard) ================= */
export const getOverview = wrap(async (_req, res) => {
  const now = new Date();
  const todayStart = istStartOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const in30 = new Date(todayStart.getTime() + 30 * DAY_MS);
  const in14 = new Date(todayStart.getTime() + 14 * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);

  const notCancelled = { status: { $ne: "cancelled" } };

  const [
    totalPackages,
    livePackages,
    countries,
    statusBreakdown,
    departureGroups,
    bookingsToday,
    confirmedToday,
    grossAll,
    grossThisWeek,
    grossLastWeek,
    calendarAgg,
    recentPackages,
    pendingReview,
  ] = await Promise.all([
    Tour.countDocuments(),
    // Live = approved + vendor ne active rakha ho
    Tour.countDocuments({ status: "APPROVED", isActive: true }),
    Tour.distinct("location.country", { status: "APPROVED" }),
    Tour.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // Departures: next 30 days (unique tour + date)
    TourBooking.aggregate([
      { $match: { ...notCancelled, travelDate: { $gte: todayStart, $lt: in30 } } },
      {
        $group: {
          _id: {
            tour: "$tour",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$travelDate", timezone: TZ } },
          },
        },
      },
      { $count: "total" },
    ]),

    TourBooking.countDocuments({ createdAt: { $gte: todayStart, $lt: tomorrowStart } }),
    TourBooking.countDocuments({
      createdAt: { $gte: todayStart, $lt: tomorrowStart },
      status: "confirmed",
    }),

    TourBooking.aggregate([
      { $match: notCancelled },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    TourBooking.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    TourBooking.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    // Departure readiness calendar (next 14 days)
    TourBooking.aggregate([
      { $match: { ...notCancelled, travelDate: { $gte: todayStart, $lt: in14 } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$travelDate", timezone: TZ } },
          tours: { $addToSet: "$tour" },
          bookings: { $sum: 1 },
        },
      },
      { $project: { tours: { $size: "$tours" }, bookings: 1 } },
    ]),

    Tour.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title location duration status isActive pricing images vendorId createdAt")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),

    Tour.countDocuments({ status: "PENDING" }),
  ]);

  const thisWeek = grossThisWeek[0]?.total || 0;
  const lastWeek = grossLastWeek[0]?.total || 0;
  const wowPercent = lastWeek > 0 ? +(((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) : null;

  const calMap = new Map(calendarAgg.map((c) => [c._id, c]));
  const calendar = Array.from({ length: 14 }, (_, i) => {
    const key = istKey(new Date(todayStart.getTime() + i * DAY_MS));
    const hit = calMap.get(key);
    return { date: key, tours: hit?.tours || 0, bookings: hit?.bookings || 0 };
  });

  res.json({
    success: true,
    data: {
      stats: {
        totalPackages,
        livePackages,
        countries: countries.filter(Boolean).length,
        departuresNext30Days: departureGroups[0]?.total || 0,
        bookingsToday,
        confirmedPercentToday: bookingsToday
          ? Math.round((confirmedToday / bookingsToday) * 100)
          : 0,
        grossValue: grossAll[0]?.total || 0,
        grossValueWoWPercent: wowPercent,
        pendingReview,
      },
      statusBreakdown: statusBreakdown.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 }
      ),
      departureCalendar: calendar,
      recentPackages: recentPackages.map(shapeTour),
    },
  });
});

/* ================= PACKAGES: LIST ================= */
export const listPackages = wrap(async (req, res) => {
  const { search, status, category, vendor, city, country, isActive, sort } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toUpperCase();
  if (category) filter.category = category;
  if (city) filter["location.city"] = new RegExp(`^${escapeRegex(city)}$`, "i");
  if (country) filter["location.country"] = country;
  if (isActive === "true" || isActive === "false") filter.isActive = isActive === "true";
  if (vendor && mongoose.isValidObjectId(vendor)) filter.vendorId = vendor;
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { title: rx },
      { "location.city": rx },
      { "location.state": rx },
      { "location.country": rx },
      { category: rx },
    ];
  }

  const sortMap = {
    oldest: { createdAt: 1 },
    priceAsc: { "pricing.adult": 1 },
    priceDesc: { "pricing.adult": -1 },
  };

  const [items, total] = await Promise.all([
    Tour.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-itinerary -inclusions -exclusions -termsAndConditions -cancellationPolicy")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    Tour.countDocuments(filter),
  ]);

  // Har tour ki booking counts
  const ids = items.map((p) => p._id);
  const bookingAgg = ids.length
    ? await TourBooking.aggregate([
        { $match: { tour: { $in: ids } } },
        {
          $group: {
            _id: "$tour",
            totalBookings: { $sum: 1 },
            confirmed: { $sum: { $cond: [{ $eq: ["$status", "confirmed"] }, 1, 0] } },
            revenue: {
              $sum: { $cond: [{ $ne: ["$status", "cancelled"] }, "$totalAmount", 0] },
            },
          },
        },
      ])
    : [];
  const bMap = new Map(bookingAgg.map((b) => [String(b._id), b]));

  const data = items.map((p) => {
    const b = bMap.get(String(p._id));
    return {
      ...shapeTour(p),
      bookingStats: {
        totalBookings: b?.totalBookings || 0,
        confirmed: b?.confirmed || 0,
        revenue: b?.revenue || 0,
      },
    };
  });

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ================= PACKAGES: DETAIL ================= */
export const getPackageById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid package id");

  const pkg = await Tour.findById(id).populate("vendorId", VENDOR_FIELDS).lean();
  if (!pkg) return fail(res, 404, "NOT_FOUND", "Package not found");

  const stats = await TourBooking.aggregate([
    { $match: { tour: pkg._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        amount: { $sum: "$totalAmount" },
      },
    },
  ]);

  res.json({ success: true, data: { ...shapeTour(pkg), bookingStats: stats } });
});

/* ================= PACKAGES: STATUS (approve / reject) ================= */
export const updatePackageStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body.status || "").toUpperCase();
  const { rejectionReason } = req.body;

  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid package id");
  if (!TOUR_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${TOUR_STATUSES.join(", ")}`);
  }

  const update = { status };
  if (status === "REJECTED") update.rejectionReason = rejectionReason || "";
  if (status === "APPROVED") update.rejectionReason = "";

  const pkg = await Tour.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  if (!pkg) return fail(res, 404, "NOT_FOUND", "Package not found");

  res.json({ success: true, data: shapeTour(pkg) });
});

/* ================= PACKAGES: ITS BOOKINGS ================= */
export const getPackageBookings = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid package id");

  const { page, limit, skip } = pageParams(req.query);
  const filter = { tour: id };
  if (req.query.status) filter.status = req.query.status;

  const [data, total] = await Promise.all([
    TourBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    TourBooking.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ================= BOOKINGS: LIST ================= */
export const listBookings = wrap(async (req, res) => {
  const { search, status, vendor, holiday, tour, from, to } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const tourId = tour || holiday; // purana param "holiday" bhi chalega

  const filter = {};
  if (status) filter.status = status;
  if (vendor && mongoose.isValidObjectId(vendor)) filter.vendorId = vendor;
  if (tourId && mongoose.isValidObjectId(tourId)) filter.tour = tourId;
  if (from || to) {
    filter.travelDate = {};
    if (from) filter.travelDate.$gte = new Date(from);
    if (to) filter.travelDate.$lte = new Date(to);
  }
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ userName: rx }, { userEmail: rx }, { userPhone: rx }];
  }

  const [data, total, summaryAgg] = await Promise.all([
    TourBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("tour", "title location duration images")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    TourBooking.countDocuments(filter),
    TourBooking.aggregate([
      {
        $match: {
          ...filter,
          // aggregate me ObjectId cast manually
          ...(filter.tour ? { tour: new mongoose.Types.ObjectId(filter.tour) } : {}),
          ...(filter.vendorId ? { vendorId: new mongoose.Types.ObjectId(filter.vendorId) } : {}),
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const summary = { pending: 0, confirmed: 0, cancelled: 0, totalAmount: 0 };
  summaryAgg.forEach((s) => {
    summary[s._id] = s.count;
    if (s._id !== "cancelled") summary.totalAmount += s.amount || 0;
  });

  const shaped = data.map((b) => ({
    ...b,
    holiday: b.tour ? shapeTour(b.tour) : b.tour, // frontend compatibility
    vendor: b.vendorId,
  }));

  res.json({
    success: true,
    data: shaped,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ================= BOOKINGS: DETAIL ================= */
export const getBookingById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");

  const booking = await TourBooking.findById(id)
    .populate("tour")
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({
    success: true,
    data: {
      ...booking,
      holiday: booking.tour ? shapeTour(booking.tour) : booking.tour,
      vendor: booking.vendorId,
    },
  });
});

/* ================= BOOKINGS: STATUS ================= */
export const updateBookingStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");
  if (!BOOKING_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${BOOKING_STATUSES.join(", ")}`);
  }

  const booking = await TourBooking.findByIdAndUpdate(id, { status }, { new: true });
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});