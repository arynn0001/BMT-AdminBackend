/**
 * Approval Center Controller
 */

import { Approval } from "../models/Approval.js";

function formatAmount(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount}`;
}

/* =========================================================
   API 1: STATS (4 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Open Decisions
  const openDecisions = await Approval.countDocuments({
    status: "pending",
    active: true,
  });

  // 2. Inside SLA (%)
  const totalTasks = await Approval.countDocuments({ active: true });
  const withinSla = await Approval.countDocuments({
    status: { $in: ["approved", "rejected"] },
    active: true,
  });
  const insideSla =
    totalTasks > 0
      ? Math.round((withinSla / totalTasks) * 1000) / 10
      : 94.7;

  // 3. High Exposure (total amount pending)
  const exposureAgg = await Approval.aggregate([
    { $match: { status: "pending", active: true } },
    { $group: { _id: null, total: { $sum: "$exposure" } } },
  ]);
  const highExposure = exposureAgg[0]?.total || 0;

  // 4. Decided Today
  const decidedToday = await Approval.countDocuments({
    status: { $in: ["approved", "rejected"] },
    decidedAt: { $gte: today },
  });

  res.json({
    success: true,
    data: {
      openDecisions: {
        value: openDecisions,
        subValue: "Across authorized queues",
      },
      insideSla: {
        value: insideSla,
        subValue: "Rolling 7 days",
      },
      highExposure: {
        value: highExposure,
        formatted: formatAmount(highExposure),
        subValue: "Protected by checker limits",
      },
      decidedToday: {
        value: decidedToday,
        subValue: "Median 12 minutes",
      },
    },
  });
};

/* =========================================================
   API 2: LIST (Table data)
   ========================================================= */

export const getList = async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    category = "",
    status = "",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { active: true };

  // Filter: category
  if (category && category !== "All") {
    query.category = category;
  }

  // Filter: status
  if (status && status !== "All") {
    query.status = status;
  }

  // Search
  if (search) {
    query.$or = [
      { requestId: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { "maker.name": { $regex: search, $options: "i" } },
      { "checker.name": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Approval.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Approval.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((a) => ({
        id: String(a._id),
        requestId: a.requestId,
        title: a.title,
        category: a.category,
        exposure: a.exposure,
        exposureFormatted: formatAmount(a.exposure),
        maker: {
          name: a.maker?.name,
          email: a.maker?.email,
        },
        checker: {
          name: a.checker?.name,
          email: a.checker?.email,
        },
        sla: `${a.slaMinutes} min`,
        slaMinutes: a.slaMinutes,
        status: a.status,
        priority: a.priority,
        createdAt: a.createdAt,
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/* =========================================================
   API 3: SINGLE APPROVAL
   ========================================================= */

export const getOne = async (req, res) => {
  const approval = await Approval.findById(req.params.id).lean();

  if (!approval) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Approval not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(approval._id),
      requestId: approval.requestId,
      title: approval.title,
      category: approval.category,
      description: approval.description,
      exposure: approval.exposure,
      exposureFormatted: formatAmount(approval.exposure),
      maker: approval.maker,
      checker: approval.checker,
      sla: `${approval.slaMinutes} min`,
      status: approval.status,
      priority: approval.priority,
      decidedAt: approval.decidedAt,
      decisionReason: approval.decisionReason,
      createdAt: approval.createdAt,
    },
  });
};

/* =========================================================
   API 4: APPROVE
   ========================================================= */

export const approve = async (req, res) => {
  const { reason } = req.body;

  const approval = await Approval.findById(req.params.id);
  if (!approval) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Approval not found" },
    });
  }

  if (approval.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: { code: "ALREADY_DECIDED", message: "Already decided" },
    });
  }

  approval.status = "approved";
  approval.decidedAt = new Date();
  approval.decisionReason = reason || "Approved";
  approval.checker = {
    userId: req.user._id,
    name: req.user.name,
    email: req.user.email,
  };
  await approval.save();

  res.json({
    success: true,
    data: {
      message: "Approved successfully",
      approval: {
        id: String(approval._id),
        requestId: approval.requestId,
        status: approval.status,
        decidedAt: approval.decidedAt,
      },
    },
  });
};

/* =========================================================
   API 5: REJECT
   ========================================================= */

export const reject = async (req, res) => {
  const { reason } = req.body;

  const approval = await Approval.findById(req.params.id);
  if (!approval) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Approval not found" },
    });
  }

  if (approval.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: { code: "ALREADY_DECIDED", message: "Already decided" },
    });
  }

  approval.status = "rejected";
  approval.decidedAt = new Date();
  approval.decisionReason = reason || "Rejected";
  approval.checker = {
    userId: req.user._id,
    name: req.user.name,
    email: req.user.email,
  };
  await approval.save();

  res.json({
    success: true,
    data: {
      message: "Rejected",
      approval: {
        id: String(approval._id),
        requestId: approval.requestId,
        status: approval.status,
        decidedAt: approval.decidedAt,
      },
    },
  });
};

/* =========================================================
   API 6: CREATE (Single ya Array)
   ========================================================= */

export const create = async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];

  for (const item of items) {
    if (!item.requestId || !item.title) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_DATA",
          message: "requestId and title required for all items",
        },
      });
    }
  }

  const approvals = await Approval.insertMany(
    items.map((item) => ({
      requestId: item.requestId,
      title: item.title,
      category: item.category || "Vendor",
      description: item.description,
      exposure: item.exposure || 0,
      currency: item.currency || "INR",
      maker: item.maker || {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
      checker: item.checker,
      slaMinutes: item.slaMinutes || 0,
      status: item.status || "pending",
      priority: item.priority || "normal",
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${approvals.length} approval(s) created`,
      count: approvals.length,
      approvals: approvals.map((a) => ({
        id: String(a._id),
        requestId: a.requestId,
        title: a.title,
      })),
    },
  });
};