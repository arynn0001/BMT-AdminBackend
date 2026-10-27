/**
 * Operations Inbox Controller
 */

import { OperationsInbox } from "../models/OperationsInbox.js";

/* =========================================================
   API 1: STATS (3 top cards)
   ========================================================= */

export const getStats = async (req, res) => {
  const [pending, approved, rejected] = await Promise.all([
    OperationsInbox.countDocuments({ status: "pending", active: true }),
    OperationsInbox.countDocuments({ status: "approved", active: true }),
    OperationsInbox.countDocuments({
      status: { $in: ["rejected", "cancelled"] },
      active: true,
    }),
  ]);

  res.json({
    success: true,
    data: {
      pendingReview: { value: pending },
      approvedForExecution: { value: approved },
      rejectedCancelled: { value: rejected },
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
    status = "",
    module = "",
  } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const query = { active: true };

  if (status && status !== "All") query.status = status;
  if (module && module !== "All") query.module = module;

  if (search) {
    query.$or = [
      { requestId: { $regex: search, $options: "i" } },
      { title: { $regex: search, $options: "i" } },
      { reference: { $regex: search, $options: "i" } },
      { "owner.name": { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    OperationsInbox.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    OperationsInbox.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((i) => ({
        id: String(i._id),
        requestId: i.requestId,
        title: i.title,
        description: i.description,
        owner: i.owner,
        reference: i.reference,
        referenceType: i.referenceType,
        module: i.module,
        status: i.status,
        priority: i.priority,
        decidedAt: i.decidedAt,
        createdAt: i.createdAt,
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
};

/* =========================================================
   API 3: SINGLE
   ========================================================= */

export const getOne = async (req, res) => {
  const item = await OperationsInbox.findById(req.params.id).lean();

  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Request not found" },
    });
  }

  res.json({
    success: true,
    data: {
      id: String(item._id),
      requestId: item.requestId,
      title: item.title,
      description: item.description,
      owner: item.owner,
      reference: item.reference,
      referenceType: item.referenceType,
      module: item.module,
      status: item.status,
      priority: item.priority,
      decidedBy: item.decidedBy,
      decidedAt: item.decidedAt,
      decisionReason: item.decisionReason,
      createdAt: item.createdAt,
    },
  });
};

/* =========================================================
   API 4: APPROVE
   ========================================================= */

export const approve = async (req, res) => {
  const { reason } = req.body;

  const item = await OperationsInbox.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Request not found" },
    });
  }

  if (item.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: { code: "ALREADY_DECIDED", message: "Already decided" },
    });
  }

  item.status = "approved";
  item.decidedAt = new Date();
  item.decisionReason = reason || "Approved";
  item.decidedBy = {
    userId: req.user._id,
    name: req.user.name,
  };
  await item.save();

  res.json({
    success: true,
    data: {
      message: "Approved successfully",
      item: {
        id: String(item._id),
        requestId: item.requestId,
        status: item.status,
      },
    },
  });
};

/* =========================================================
   API 5: REJECT
   ========================================================= */

export const reject = async (req, res) => {
  const { reason } = req.body;

  const item = await OperationsInbox.findById(req.params.id);
  if (!item) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Request not found" },
    });
  }

  if (item.status !== "pending") {
    return res.status(400).json({
      success: false,
      error: { code: "ALREADY_DECIDED", message: "Already decided" },
    });
  }

  item.status = "rejected";
  item.decidedAt = new Date();
  item.decisionReason = reason || "Rejected";
  item.decidedBy = {
    userId: req.user._id,
    name: req.user.name,
  };
  await item.save();

  res.json({
    success: true,
    data: {
      message: "Rejected",
      item: {
        id: String(item._id),
        requestId: item.requestId,
        status: item.status,
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

  const requests = await OperationsInbox.insertMany(
    items.map((item) => ({
      requestId: item.requestId,
      title: item.title,
      description: item.description,
      owner: item.owner || {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
      reference: item.reference,
      referenceType: item.referenceType,
      module: item.module || "Executive",
      status: item.status || "pending",
      priority: item.priority || "normal",
      active: true,
    }))
  );

  res.status(201).json({
    success: true,
    data: {
      message: `${requests.length} request(s) created`,
      count: requests.length,
      requests: requests.map((r) => ({
        id: String(r._id),
        requestId: r.requestId,
        title: r.title,
      })),
    },
  });
};