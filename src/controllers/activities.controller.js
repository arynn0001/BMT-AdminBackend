/**
 * Activities Controller (Admin)
 * Overview dashboard, activities list/detail/status/toggle,
 * schedules (slots) list/detail/toggle, bookings list/detail/status.
 */
import mongoose from "mongoose";
import {
  Activity,
  ActivitySchedule,
  ActivityBooking,
  ACTIVITY_STATUSES,
  ACTIVITY_BOOKING_STATUSES,
} from "../models/activities.model.js";

/* ================= HELPERS ================= */
const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error("ACTIVITIES ADMIN ERROR:", err);
    res.status(500).json({
      success: false,
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
};

const fail = (res, status, code, message, extra = {}) =>
  res.status(status).json({ success: false, error: { code, message }, ...extra });

const isValidId = (id) => mongoose.isValidObjectId(id);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const TZ = "Asia/Kolkata";
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" in IST
const istKey = (d) => d.toLocaleDateString("en-CA", { timeZone: TZ });
// IST midnight (createdAt jaise real timestamps ke liye)
const istStartOfDay = (d) => new Date(`${istKey(d)}T00:00:00+05:30`);
// Schedule.date vendor side par UTC midnight store hoti hai ("2026-10-15" -> 00:00Z)
const utcDayRange = (value) => {
  const s = new Date(value);
  if (Number.isNaN(s.getTime())) return null;
  s.setUTCHours(0, 0, 0, 0);
  return { start: s, end: new Date(s.getTime() + DAY_MS) };
};

const pageParams = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(q.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  pages: Math.ceil(total / limit),
});

const VENDOR_FIELDS = "name email phone companyName businessName";
const USER_FIELDS = "fullname name email phone";
const NOT_CANCELLED = { status: { $nin: ["CANCELLED", "REJECTED"] } };

const withAvailability = (s) => ({
  ...s,
  availableSlots: Math.max(0, (s.totalSlots || 0) - (s.bookedSlots || 0)),
});

/* ================= OVERVIEW (Dashboard) ================= */
export const getOverview = wrap(async (_req, res) => {
  const now = new Date();
  const todayStart = istStartOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const in7 = new Date(now.getTime() + 7 * DAY_MS);

  // Schedule.date UTC midnight hoti hai, isliye aaj ki IST date ko UTC midnight bana ke range lo
  const schedStart = new Date(`${istKey(now)}T00:00:00Z`);
  const schedEnd = new Date(schedStart.getTime() + DAY_MS);

  const live = { status: "APPROVED", isActive: true };

  const [
    totalActivities,
    liveActivities,
    cities,
    activityStatusAgg,
    schedulesToday,
    bookingsToday,
    grossAll,
    grossThisWeek,
    grossLastWeek,
    bookingStatusAgg,
    upcomingBookings,
    recentActivities,
    pendingReview,
  ] = await Promise.all([
    Activity.countDocuments(),
    Activity.countDocuments(live),
    Activity.distinct("location.city", live),
    Activity.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),

    ActivitySchedule.find({ date: { $gte: schedStart, $lt: schedEnd }, isActive: true })
      .sort({ startTime: 1 })
      .populate("activityId", "title location.city")
      .lean(),

    ActivityBooking.countDocuments({ createdAt: { $gte: todayStart, $lt: tomorrowStart } }),

    ActivityBooking.aggregate([
      { $match: NOT_CANCELLED },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    ActivityBooking.aggregate([
      { $match: { ...NOT_CANCELLED, createdAt: { $gte: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    ActivityBooking.aggregate([
      { $match: { ...NOT_CANCELLED, createdAt: { $gte: twoWeeksAgo, $lt: weekAgo } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),

    ActivityBooking.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ActivityBooking.countDocuments({
      status: { $in: ["PENDING", "CONFIRMED"] },
      startsAt: { $gte: now, $lt: in7 },
    }),

    Activity.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("title category activityType location.city status isActive thumbnail pricing.adult vendorId createdAt")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),

    Activity.countDocuments({ status: "PENDING" }),
  ]);

  const totalSlotsToday = schedulesToday.reduce((n, s) => n + (s.totalSlots || 0), 0);
  const bookedSlotsToday = schedulesToday.reduce((n, s) => n + (s.bookedSlots || 0), 0);

  const thisWeek = grossThisWeek[0]?.total || 0;
  const lastWeek = grossLastWeek[0]?.total || 0;
  const wowPercent = lastWeek > 0 ? +(((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1) : null;

  res.json({
    success: true,
    data: {
      stats: {
        totalActivities,
        liveActivities,
        destinations: cities.filter(Boolean).length,
        slotsToday: totalSlotsToday,
        bookedSlotsToday,
        capacityPercentToday: totalSlotsToday
          ? Math.round((bookedSlotsToday / totalSlotsToday) * 100)
          : 0,
        bookingsToday,
        upcomingBookingsNext7Days: upcomingBookings,
        grossValue: grossAll[0]?.total || 0,
        grossValueWoWPercent: wowPercent,
        pendingReview,
      },
      activityStatusBreakdown: activityStatusAgg.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 }
      ),
      bookingStatusBreakdown: bookingStatusAgg.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        { PENDING: 0, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, COMPLETED: 0 }
      ),
      todaySlots: schedulesToday.slice(0, 12).map((s) => ({
        _id: s._id,
        activity: s.activityId?.title || "—",
        city: s.activityId?.location?.city || "",
        startTime: s.startTime,
        endTime: s.endTime,
        bookedSlots: s.bookedSlots,
        totalSlots: s.totalSlots,
        availableSlots: Math.max(0, s.totalSlots - s.bookedSlots),
      })),
      recentActivities,
    },
  });
});

/* ================= ACTIVITIES: LIST ================= */
export const listActivities = wrap(async (req, res) => {
  const { search, status, category, activityType, city, vendor, isActive, sort } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toUpperCase();
  if (category) filter.category = category;
  if (activityType) filter.activityType = String(activityType).toUpperCase();
  if (city) filter["location.city"] = new RegExp(`^${escapeRegex(city.trim())}$`, "i");
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (search?.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ title: rx }, { category: rx }, { activityType: rx }, { "location.city": rx }];
  }

  const sortMap = {
    oldest: { createdAt: 1 },
    priceAsc: { "pricing.adult": 1 },
    priceDesc: { "pricing.adult": -1 },
  };

  const [items, total] = await Promise.all([
    Activity.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-description -highlights -inclusions -exclusions -requirements -termsAndConditions -images")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    Activity.countDocuments(filter),
  ]);

  // Har activity ke liye booking + upcoming schedule stats
  const ids = items.map((a) => a._id);
  const todayUtc = new Date(`${istKey(new Date())}T00:00:00Z`);

  const [bookingAgg, scheduleAgg] = ids.length
    ? await Promise.all([
        ActivityBooking.aggregate([
          { $match: { activityId: { $in: ids } } },
          {
            $group: {
              _id: "$activityId",
              totalBookings: { $sum: 1 },
              confirmed: { $sum: { $cond: [{ $eq: ["$status", "CONFIRMED"] }, 1, 0] } },
              revenue: {
                $sum: {
                  $cond: [{ $in: ["$status", ["CANCELLED", "REJECTED"]] }, 0, "$totalAmount"],
                },
              },
            },
          },
        ]),
        ActivitySchedule.aggregate([
          { $match: { activityId: { $in: ids }, isActive: true, date: { $gte: todayUtc } } },
          {
            $group: {
              _id: "$activityId",
              upcomingSchedules: { $sum: 1 },
              totalSlots: { $sum: "$totalSlots" },
              bookedSlots: { $sum: "$bookedSlots" },
            },
          },
        ]),
      ])
    : [[], []];

  const bMap = new Map(bookingAgg.map((b) => [String(b._id), b]));
  const sMap = new Map(scheduleAgg.map((s) => [String(s._id), s]));

  const data = items.map((a) => {
    const b = bMap.get(String(a._id));
    const s = sMap.get(String(a._id));
    return {
      ...a,
      bookingStats: {
        totalBookings: b?.totalBookings || 0,
        confirmed: b?.confirmed || 0,
        revenue: b?.revenue || 0,
      },
      scheduleStats: {
        upcomingSchedules: s?.upcomingSchedules || 0,
        totalSlots: s?.totalSlots || 0,
        bookedSlots: s?.bookedSlots || 0,
      },
    };
  });

  res.json({ success: true, count: data.length, data, pagination: pagination(page, limit, total) });
});

/* ================= ACTIVITIES: DETAIL ================= */
export const getActivityById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid activity id");

  const activity = await Activity.findById(id).populate("vendorId", VENDOR_FIELDS).lean();
  if (!activity) return fail(res, 404, "NOT_FOUND", "Activity not found");

  const todayUtc = new Date(`${istKey(new Date())}T00:00:00Z`);

  const [bookingStats, upcomingSchedules] = await Promise.all([
    ActivityBooking.aggregate([
      { $match: { activityId: activity._id } },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
    ]),
    ActivitySchedule.find({ activityId: activity._id, date: { $gte: todayUtc } })
      .sort({ date: 1, startTime: 1 })
      .limit(20)
      .lean(),
  ]);

  res.json({
    success: true,
    data: {
      ...activity,
      bookingStats,
      upcomingSchedules: upcomingSchedules.map(withAvailability),
    },
  });
});

/* ================= ACTIVITIES: STATUS (approve / reject) ================= */
export const updateActivityStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toUpperCase();
  const reason = String(req.body?.rejectionReason || "").trim();

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid activity id");
  if (!ACTIVITY_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${ACTIVITY_STATUSES.join(", ")}`);
  }
  if (status === "REJECTED" && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "rejectionReason is required when rejecting");
  }

  const update = status === "REJECTED"
    ? { status, rejectionReason: reason.slice(0, 300) }
    : { status, $unset: { rejectionReason: "" } };

  const activity = await Activity.findByIdAndUpdate(id, update, { new: true });
  if (!activity) return fail(res, 404, "NOT_FOUND", "Activity not found");

  res.json({ success: true, message: `Activity ${status.toLowerCase()}`, data: activity });
});

/* ================= ACTIVITIES: TOGGLE ACTIVE ================= */
export const toggleActivity = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid activity id");

  const activity = await Activity.findById(id);
  if (!activity) return fail(res, 404, "NOT_FOUND", "Activity not found");

  const updated = await Activity.findByIdAndUpdate(
    id,
    { isActive: !activity.isActive },
    { new: true }
  );

  res.json({
    success: true,
    message: `Activity ${updated.isActive ? "activated" : "deactivated"}`,
    data: updated,
  });
});

/* ================= ACTIVITIES: ITS SCHEDULES ================= */
export const getActivitySchedules = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid activity id");

  const data = await ActivitySchedule.find({ activityId: id })
    .sort({ date: -1, startTime: 1 })
    .limit(200)
    .lean();

  res.json({ success: true, count: data.length, data: data.map(withAvailability) });
});

/* ================= SCHEDULES: LIST ================= */
export const listSchedules = wrap(async (req, res) => {
  const { activityId, vendor, date, from, to, isActive } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (activityId) {
    if (!isValidId(activityId)) return fail(res, 400, "INVALID_ID", "Invalid activityId");
    filter.activityId = activityId;
  }
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (isActive !== undefined) filter.isActive = isActive === "true";

  if (date) {
    const range = utcDayRange(date);
    if (!range) return fail(res, 400, "INVALID_DATE", "Invalid date");
    filter.date = { $gte: range.start, $lt: range.end };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    ActivitySchedule.find(filter)
      .sort({ date: -1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .populate("activityId", "title slug category location.city thumbnail")
      .populate("vendorId", VENDOR_FIELDS)
      .lean(),
    ActivitySchedule.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count: items.length,
    data: items.map(withAvailability),
    pagination: pagination(page, limit, total),
  });
});

/* ================= SCHEDULES: DETAIL ================= */
export const getScheduleById = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid schedule id");

  const schedule = await ActivitySchedule.findById(id)
    .populate("activityId", "title slug category location pricing maxGuests thumbnail")
    .populate("vendorId", VENDOR_FIELDS)
    .lean();
  if (!schedule) return fail(res, 404, "NOT_FOUND", "Schedule not found");

  res.json({ success: true, data: withAvailability(schedule) });
});

/* ================= SCHEDULES: TOGGLE ================= */
export const toggleSchedule = wrap(async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid schedule id");

  const schedule = await ActivitySchedule.findById(id);
  if (!schedule) return fail(res, 404, "NOT_FOUND", "Schedule not found");

  const updated = await ActivitySchedule.findByIdAndUpdate(
    id,
    { isActive: !schedule.isActive },
    { new: true }
  ).lean();

  res.json({
    success: true,
    message: `Schedule ${updated.isActive ? "activated" : "deactivated"}`,
    data: withAvailability(updated),
  });
});

/* ================= BOOKINGS: LIST ================= */
export const listBookings = wrap(async (req, res) => {
  const { search, status, paymentStatus, vendor, activityId, scheduleId, date, from, to } = req.query;
  const { page, limit, skip } = pageParams(req.query);

  const filter = {};
  if (status) filter.status = String(status).toUpperCase();
  if (paymentStatus) filter.paymentStatus = String(paymentStatus).toUpperCase();
  if (vendor && isValidId(vendor)) filter.vendorId = vendor;
  if (activityId) {
    if (!isValidId(activityId)) return fail(res, 400, "INVALID_ID", "Invalid activityId");
    filter.activityId = activityId;
  }
  if (scheduleId) {
    if (!isValidId(scheduleId)) return fail(res, 400, "INVALID_ID", "Invalid scheduleId");
    filter.scheduleId = scheduleId;
  }

  if (date) {
    const range = utcDayRange(date);
    if (!range) return fail(res, 400, "INVALID_DATE", "Invalid date");
    filter.activityDate = { $gte: range.start, $lt: range.end };
  } else if (from || to) {
    filter.activityDate = {};
    if (from) filter.activityDate.$gte = new Date(from);
    if (to) filter.activityDate.$lte = new Date(to);
  }

  if (search?.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [
      { bookingId: rx },
      { "leadTraveller.name": rx },
      { "leadTraveller.email": rx },
      { "leadTraveller.phone": rx },
    ];
  }

  const [data, total, summaryAgg] = await Promise.all([
    ActivityBooking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("activityId", "title slug category location.city thumbnail")
      .populate("vendorId", VENDOR_FIELDS)
      .populate("userId", USER_FIELDS)
      .lean(),
    ActivityBooking.countDocuments(filter),
    ActivityBooking.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$totalAmount" } } },
    ]),
  ]);

  const summary = { PENDING: 0, CONFIRMED: 0, REJECTED: 0, CANCELLED: 0, COMPLETED: 0, totalAmount: 0 };
  summaryAgg.forEach((s) => {
    summary[s._id] = s.count;
    if (!["CANCELLED", "REJECTED"].includes(s._id)) summary.totalAmount += s.amount || 0;
  });

  res.json({
    success: true,
    count: data.length,
    data,
    summary,
    pagination: pagination(page, limit, total),
  });
});

/* ================= BOOKINGS: DETAIL (_id ya bookingId) ================= */
export const getBookingById = wrap(async (req, res) => {
  const { id } = req.params;
  const query = isValidId(id) ? { _id: id } : { bookingId: String(id).toUpperCase() };

  const booking = await ActivityBooking.findOne(query)
    .populate("activityId", "title slug category location meetingPoint pickupAvailable pickupDetails cancellationPolicy thumbnail")
    .populate("scheduleId", "date startTime endTime totalSlots bookedSlots")
    .populate("vendorId", VENDOR_FIELDS)
    .populate("userId", USER_FIELDS)
    .lean();
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  res.json({ success: true, data: booking });
});

/* ================= BOOKINGS: STATUS (admin override) =================
 * Allowed:
 *   PENDING   -> CONFIRMED | REJECTED | CANCELLED
 *   CONFIRMED -> CANCELLED | COMPLETED
 * CANCELLED / REJECTED par slots schedule me wapas release hote hain.
 * statusHistory.by / cancelledBy vendor schema me USER|VENDOR|SYSTEM hi allowed hai,
 * isliye admin action "SYSTEM" ke saath "Admin:" note ke roop me save hota hai.
 */
const TRANSITIONS = {
  PENDING: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
};

export const updateBookingStatus = wrap(async (req, res) => {
  const { id } = req.params;
  const status = String(req.body?.status || "").toUpperCase();
  const reason = String(req.body?.reason || "").trim().slice(0, 300);

  if (!isValidId(id)) return fail(res, 400, "INVALID_ID", "Invalid booking id");
  if (!ACTIVITY_BOOKING_STATUSES.includes(status)) {
    return fail(res, 400, "INVALID_STATUS", `Status must be one of: ${ACTIVITY_BOOKING_STATUSES.join(", ")}`);
  }

  const booking = await ActivityBooking.findById(id);
  if (!booking) return fail(res, 404, "NOT_FOUND", "Booking not found");

  const allowed = TRANSITIONS[booking.status] || [];
  if (!allowed.includes(status)) {
    return fail(
      res,
      400,
      "INVALID_TRANSITION",
      `Cannot change ${booking.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }

  const isCancel = status === "CANCELLED" || status === "REJECTED";
  if (isCancel && !reason) {
    return fail(res, 400, "REASON_REQUIRED", "reason is required for cancel / reject");
  }
  if (status === "COMPLETED" && booking.startsAt > new Date()) {
    return fail(res, 400, "NOT_STARTED", "Activity has not started yet");
  }

  const set = { status };
  if (status === "CONFIRMED") set.confirmedAt = new Date();
  if (status === "COMPLETED") set.completedAt = new Date();
  if (isCancel) {
    set.cancelledBy = "SYSTEM";
    set.cancellationReason = reason;
    set.cancelledAt = new Date();
    if (booking.paymentStatus === "PAID") set.paymentStatus = "REFUND_PENDING";
  }

  // Atomic: status beech me badal gaya to update nahi hoga (double-click safe)
  const updated = await ActivityBooking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    {
      $set: set,
      $push: {
        statusHistory: {
          status,
          by: "SYSTEM",
          note: `Admin: ${reason || status}`,
          at: new Date(),
        },
      },
    },
    { new: true }
  );
  if (!updated) return fail(res, 409, "STATUS_CHANGED", "Booking status changed, please refresh");

  if (isCancel) {
    await ActivitySchedule.updateOne(
      { _id: updated.scheduleId, bookedSlots: { $gte: updated.slotsBooked } },
      { $inc: { bookedSlots: -updated.slotsBooked } }
    );
  }

  res.json({ success: true, message: `Booking ${status.toLowerCase()}`, data: updated });
});