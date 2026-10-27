/**
 * Packages Controller (Admin)
 * Overview dashboard, packages list/detail/status, bookings list/detail/status.
 */
import mongoose from "mongoose";
import {
  HolidayPackage,
  HolidayBooking,
  PACKAGE_STATUSES,
  BOOKING_STATUSES,
} from "../models/packages.model.js";

/* ================= HELPERS ================= */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
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
    HolidayPackage.countDocuments(),
    HolidayPackage.countDocuments({ status: "active" }),
    HolidayPackage.distinct("country", { status: "active" }),
    HolidayPackage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    // Departures: next 30 days (unique package + date)
    HolidayBooking.aggregate([
      { $match: { ...notCancelled, travelDate: { $gte: todayStart, $lt: in30 } } },
      {
        $group: {
          _id: {
            holiday: "$holiday",
            day: { $dateToString: { format: "%Y-%m-%d", date: "$travelDate", timezone: TZ } },
          },
        },
      },
      { $count: "total" },
    ]),

    HolidayBooking.countDocuments({ createdAt: { $gte: todayStart, $lt: tomorrowStart } }),
    HolidayBooking.countDocuments({
      createdAt: { $gte: todayStart, $lt: tomorrowStart },
      status: "confirmed",
    }),

    HolidayBooking.aggregate([
      { $match: notCancelled },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    HolidayBooking.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    HolidayBooking.aggregate([
      { $match: { ...notCancelled, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    // Departure readiness calendar (next 14 days)
    HolidayBooking.aggregate([
      { $match: { ...notCancelled, travelDate: { $gte: todayStart, $lt: in14 } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$travelDate", timezone: TZ } },
          holidays: { $addToSet: "$holiday" },
          bookings: { $sum: 1 },
        },
      },
      { $project: { tours: { $size: "$holidays" }, bookings: 1 } },
    ]),

    HolidayPackage.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title destination duration status pricing.perPerson bannerImage vendor createdAt")
      .populate("vendor", VENDOR_FIELDS)
      .lean(),

    HolidayPackage.countDocuments({ status: "inactive" }),
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
        countries: countries.length,
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
        { active: 0, inactive: 0, blocked: 0 }
      ),
      departureCalendar: calendar,
      recentPackages,
    },
  });
});

/* ================= PACKAGES: LIST ================= */
export const listPackages = wrap(async (req, res) => {
  const { search, status, packageType, category, vendor, country, sort } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (packageType) filter.packageType = packageType;
  if (category) filter.category = category;
  if (country) filter.country = country;
  if (vendor && mongoose.isValidObjectId(vendor)) filter.vendor = vendor;
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ title: rx }, { destination: rx }, { country: rx }];
  }

  const sortMap = {
    oldest: { createdAt: 1 },
    priceAsc: { "pricing.perPerson": 1 },
    priceDesc: { "pricing.perPerson": -1 },
  };

  const [items, total] = await Promise.all([
    HolidayPackage.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-itinerary -galleryImages -inclusions -exclusions")
      .populate("vendor", VENDOR_FIELDS)
      .lean(),
    HolidayPackage.countDocuments(filter),
  ]);

  // Har package ki booking counts
  const ids = items.map((p) => p._id);
  const bookingAgg = ids.length
    ? await HolidayBooking.aggregate([
        { $match: { holiday: { $in: ids } } },
        {
          $group: {
            _id: "$holiday",
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
      ...p,
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

  const pkg = await HolidayPackage.findById(id).populate("vendor", VENDOR_FIELDS).lean();
  if (!pkg) return fail(res, 404, "NOT_FOUND", "Package not found");

  const stats = await HolidayBooking.aggregate([
    { $match: { holiday: pkg._id } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        amount: { $sum: "$totalAmount" },
      },
    },
  ]);

  res.json({ success: true, data: { ...pkg, bookingStats: stats } });
});

/* ================= PACKAGES: STATUS (approve / block) ================= */
export const updatePackageStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid package id");
  if (!PACKAGE_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${PACKAGE_STATUSES.join(", ")}`);
  }

  const pkg = await HolidayPackage.findByIdAndUpdate(id, { status }, { new: true });
  if (!pkg) return fail(res, 404, "NOT_FOUND", "Package not found");

  res.json({ success: true, data: pkg });
});

/* ================= PACKAGES: ITS BOOKINGS ================= */
export const getPackageBookings = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid package id");

  const { page, limit, skip } = pageParams(req.query);
  const filter = { holiday: id };
  if (req.query.status) filter.status = req.query.status;

  const [data, total] = await Promise.all([
    HolidayBooking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    HolidayBooking.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ================= BOOKINGS: LIST ================= */
export const listBookings = wrap(async (req, res) => {
  const { search, status, vendor, holiday, from, to } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = status;
  if (vendor && mongoose.isValidObjectId(vendor)) filter.vendor = vendor;
  if (holiday && mongoose.isValidObjectId(holiday)) filter.holiday = holiday;
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
    HolidayBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("holiday", "title destination duration bannerImage")
      .populate("vendor", VENDOR_FIELDS)
      .lean(),
    HolidayBooking.countDocuments(filter),
    HolidayBooking.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const summary = { pending: 0, confirmed: 0, cancelled: 0, totalAmount: 0 };
  summaryAgg.forEach((s) => {
    summary[s._id] = s.count;
    if (s._id !== "cancelled") summary.totalAmount += s.amount || 0;
  });

  res.json({
    success: true,
    data,
    summary,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

/* ================= BOOKINGS: DETAIL ================= */
export const getBookingById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");

  const booking = await HolidayBooking.findById(id)
    .populate("holiday")
    .populate("vendor", VENDOR_FIELDS)
    .lean();
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});

/* ================= BOOKINGS: STATUS ================= */
export const updateBookingStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!mongoose.isValidObjectId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");
  if (!BOOKING_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${BOOKING_STATUSES.join(", ")}`);
  }

  const booking = await HolidayBooking.findByIdAndUpdate(id, { status }, { new: true });
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});