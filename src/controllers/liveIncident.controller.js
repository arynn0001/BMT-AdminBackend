/**
 * Live Incident Controller
 * 
 * Incident Command ke saare APIs.
 */

import { LiveIncident } from "../models/LiveIncident.js";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Open Incidents
  const openIncidents = await LiveIncident.countDocuments({
    status: { $in: ["Active", "Mitigating", "Monitoring"] },
    active: true,
  });

  // P0 count for sub-value
  const p0Count = await LiveIncident.countDocuments({
    severity: "P0",
    status: { $in: ["Active", "Mitigating", "Monitoring"] },
    active: true,
  });

  // 2. MTTA (Mean Time To Acknowledge) - average of recent incidents
  const mttaAgg = await LiveIncident.aggregate([
    { $match: { mttaSeconds: { $gt: 0 }, active: true } },
    { $group: { _id: null, avg: { $avg: "$mttaSeconds" } } },
  ]);
  const mtta = Math.round(mttaAgg[0]?.avg || 42);

  // 3. Impacted Bookings (sum of active incidents)
  const impactedAgg = await LiveIncident.aggregate([
    { $match: { status: { $in: ["Active", "Mitigating", "Monitoring"] }, active: true } },
    { $group: { _id: null, total: { $sum: "$impactedBookings" } } },
  ]);
  const impactedBookings = impactedAgg[0]?.total || 0;

  // 4. Resolved Today
  const resolvedToday = await LiveIncident.countDocuments({
    status: "Resolved",
    resolvedAt: { $gte: today },
  });

  res.json({
    success: true,
    data: {
      openIncidents: {
        value: openIncidents,
        subValue: `${p0Count} traveller safety P0`,
      },
      mtta: {
        value: `${mtta} sec`,
        mttaSeconds: mtta,
        subValue: "Target under 60 seconds",
      },
      impactedBookings: {
        value: impactedBookings,
        subValue: `Across ${openIncidents} active events`,
      },
      resolvedToday: {
        value: resolvedToday,
        subValue: "3 postmortems due",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (Filter ke saath)
   ========================================================= */

export const getList = async (req, res) => {
  const { filter = "Active", page = 1, limit = 20 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { active: true };

  // Filter tabs
  if (filter === "Active") {
    query.status = { $in: ["Active", "Mitigating", "Monitoring"] };
  } else if (filter === "Resolved") {
    query.status = "Resolved";
  } else if (filter !== "All") {
    query.category = filter;
  }

  const [items, total] = await Promise.all([
    LiveIncident.find(query)
      .sort({ severity: 1, declaredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    LiveIncident.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      filter,
      items: items.map((i) => ({
        id: String(i._id),
        incidentId: i.incidentId,
        title: i.title,
        severity: i.severity,
        severityLabel: i.severityLabel,
        status: i.status,
        category: i.category,
        domain: i.domain,
        region: i.region,
        impact: i.impact,
        impactedBookings: i.impactedBookings,
        ic: i.ic,
        timeAgo: timeAgo(i.declaredAt),
        declaredAt: i.declaredAt,
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/* =========================================================
   API 3: SINGLE INCIDENT
   ========================================================= */

export const getOne = async (req, res) => {
  const incident = await LiveIncident.findById(req.params.id).lean();

  if (!incident) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Incident not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(incident._id),
      incidentId: incident.incidentId,
      title: incident.title,
      severity: incident.severity,
      severityLabel: incident.severityLabel,
      status: incident.status,
      category: incident.category,
      domain: incident.domain,
      region: incident.region,
      impact: incident.impact,
      impactedBookings: incident.impactedBookings,
      ic: incident.ic,
      timeAgo: timeAgo(incident.declaredAt),
      declaredAt: incident.declaredAt,
      resolvedAt: incident.resolvedAt,
      mttaSeconds: incident.mttaSeconds,
    },
  });
};

/* =========================================================
   API 4: DECLARE (Create - Admin Panel Se)
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.incidentId || !item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "incidentId and title required for all items",
        },
      });
    }
  }

  const incidents = await LiveIncident.insertMany(
    items.map((item) => ({
      incidentId: item.incidentId,
      title: item.title,
      severity: item.severity || "P2",
      severityLabel: item.severityLabel || "Medium",
      status: item.status || "Active",
      category: item.category || "Other",
      domain: item.domain,
      region: item.region,
      impact: item.impact,
      impactedBookings: item.impactedBookings || 0,
      ic: item.ic || {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
      mttaSeconds: item.mttaSeconds || 0,
      declaredAt: new Date(),
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${incidents.length} incident(s) declared`,
      count: incidents.length,
      incidents: incidents.map((i) => ({
        id: String(i._id),
        incidentId: i.incidentId,
        title: i.title,
        severity: i.severity,
      })),
    },
  });
};

/* =========================================================
   API 5: UPDATE STATUS (Resolve, Mitigate, etc.)
   ========================================================= */

export const updateStatus = async (req, res) => {
  const { status } = req.body;

  const validStatuses = ["Active", "Mitigating", "Monitoring", "Resolved"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_STATUS", message: "Invalid status" },
    });
  }

  const incident = await LiveIncident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Incident not found" },
    });
  }

  incident.status = status;
  if (status === "Resolved") {
    incident.resolvedAt = new Date();
  }
  await incident.save();

  res.json({
    success: true,
    data: {
      message: `Status updated to ${status}`,
      incident: {
        id: String(incident._id),
        incidentId: incident.incidentId,
        status: incident.status,
      },
    },
  });
};

/* =========================================================
   API 6: DELETE (Soft)
   ========================================================= */

export const remove = async (req, res) => {
  const incident = await LiveIncident.findById(req.params.id);
  if (!incident) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Incident not found" },
    });
  }

  incident.active = false;
  await incident.save();

  res.json({
    success: true,
    data: { message: "Incident removed" },
  });
};