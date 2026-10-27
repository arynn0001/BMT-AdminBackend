/**
 * Auth Controller
 * 
 * Admin + Employee signup, login, management.
 */

import { User, Role, Session, Audit } from "../models/system.js";
import { hashPassword, verifyPassword, generateToken, digest } from "../utils/crypto.js";
import { fail } from "../utils/response.js";

/* =========================================================
   DEFAULT ROLES
   ========================================================= */

/**
 * Admin role dhundo ya banao
 */
async function getAdminRole() {
  let role = await Role.findOne({ name: "Admin" });
  if (!role) {
    role = await Role.create({
      name: "Admin",
      description: "Full system access",
      permissions: ["*:*"],
      scopes: {
        department: ["*"],
        market: ["*"],
        country: ["*"],
        vertical: ["*"],
        branch: ["*"],
      },
      ownRecordsOnly: false,
    });
  }
  return role;
}

/**
 * Employee role dhundo ya banao
 */
async function getEmployeeRole() {
  let role = await Role.findOne({ name: "Employee" });
  if (!role) {
    role = await Role.create({
      name: "Employee",
      description: "Basic employee access",
      permissions: [
        "bookings:read",
        "bookings:write",
        "customers:read",
        "vendors:read",
      ],
      scopes: {
        department: ["*"],
        market: ["*"],
        country: ["*"],
        vertical: ["*"],
        branch: ["*"],
      },
      ownRecordsOnly: false,
    });
  }
  return role;
}

/* =========================================================
   SIGNUP (Admin - first user)
   ========================================================= */

export const signup = async (req, res) => {
  const { name, email, phone, password } = req.body;

  // Validation
  if (!name || name.trim().length < 2) {
    fail(400, "INVALID_NAME", "Name must be at least 2 characters");
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    fail(400, "INVALID_EMAIL", "Invalid email format");
  }
  if (!password || password.length < 8) {
    fail(400, "INVALID_PASSWORD", "Password must be at least 8 characters");
  }

  // Duplicate checks
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    fail(409, "EMAIL_ALREADY_EXISTS", "This email is already registered");
  }

  if (phone) {
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      fail(409, "PHONE_ALREADY_EXISTS", "This phone number is already registered");
    }
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Admin role
  const role = await getAdminRole();

  // User banao
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone || undefined,
    passwordHash,
    roles: [role._id],
    active: true,
  });

  // Audit
  await Audit.create({
    actorId: String(user._id),
    action: "auth.signup",
    recordId: String(user._id),
    metadata: { email: user.email, role: "Admin" },
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(201).json({
    success: true,
    data: {
      message: "Admin account created successfully",
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: role.name,
      },
    },
  });
};

/* =========================================================
   LOGIN (Admin + Employee)
   ========================================================= */

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    fail(400, "VALIDATION_ERROR", "Email and password are required");
  }

  // User dhundo
  const user = await User.findOne({ email: email.toLowerCase() })
    .select("+passwordHash")
    .populate("roles");

  if (!user) {
    fail(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  // Account checks
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    fail(401, "ACCOUNT_LOCKED", "Account locked. Try again later.");
  }

  if (!user.active) {
    fail(401, "ACCOUNT_DISABLED", "Account disabled. Contact admin.");
  }

  // Password verify
  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
    await user.save();
    fail(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  // Reset
  user.failedLogins = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  // Token
  const token = generateToken();
  const tokenHash = digest(token);

  // Session (30 days)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await Session.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    lastSeen: new Date(),
    device: req.get("User-Agent")?.slice(0, 240) || "unknown",
    ip: req.ip,
  });

  // Audit
  await Audit.create({
    actorId: String(user._id),
    action: "auth.login",
    recordId: String(user._id),
    metadata: { email: user.email },
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Effective permissions
  const allPermissions = new Set();
  user.roles.forEach((r) => r.permissions.forEach((p) => allPermissions.add(p)));

  res.json({
    success: true,
    data: {
      message: "Login successful",
      accessToken: token,
      tokenType: "Bearer",
      expiresAt,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        roles: user.roles.map((r) => ({
          id: String(r._id),
          name: r.name,
          permissions: r.permissions,
        })),
        permissions: Array.from(allPermissions),
      },
    },
  });
};

/* =========================================================
   ME
   ========================================================= */

export const me = async (req, res) => {
  const user = req.user;

  const allPermissions = new Set();
  user.roles.forEach((role) => {
    role.permissions.forEach((p) => allPermissions.add(p));
  });

  res.json({
    success: true,
    data: {
      id: String(user._id),
      email: user.email,
      name: user.name,
      phone: user.phone,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      roles: user.roles.map((r) => ({
        id: String(r._id),
        name: r.name,
        permissions: r.permissions,
        scopes: r.scopes,
      })),
      permissions: Array.from(allPermissions),
      scopes: user.scopes,
      createdAt: user.createdAt,
    },
  });
};

/* =========================================================
   LOGOUT
   ========================================================= */

export const logout = async (req, res) => {
  await Session.updateOne(
    { _id: req.session._id },
    { $set: { revokedAt: new Date() } }
  );

  await Audit.create({
    actorId: String(req.user._id),
    action: "auth.logout",
    recordId: String(req.user._id),
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
};

/* =========================================================
   EMPLOYEES (Admin only)
   ========================================================= */

/**
 * Naya employee banao
 */
export const createEmployee = async (req, res) => {
  const { name, email, phone, password } = req.body;

  // Validation
  if (!name || name.trim().length < 2) {
    fail(400, "INVALID_NAME", "Name must be at least 2 characters");
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    fail(400, "INVALID_EMAIL", "Invalid email format");
  }
  if (!password || password.length < 8) {
    fail(400, "INVALID_PASSWORD", "Password must be at least 8 characters");
  }

  // Duplicate
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    fail(409, "EMAIL_ALREADY_EXISTS", "This email is already registered");
  }

  if (phone) {
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      fail(409, "PHONE_ALREADY_EXISTS", "This phone number is already registered");
    }
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Employee role
  const role = await getEmployeeRole();

  // User banao
  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase(),
    phone: phone || undefined,
    passwordHash,
    roles: [role._id],
    active: true,
  });

  // Audit
  await Audit.create({
    actorId: String(req.user._id),
    action: "employee.create",
    recordId: String(user._id),
    metadata: { email: user.email, role: "Employee" },
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.status(201).json({
    success: true,
    data: {
      message: "Employee created successfully",
      employee: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: role.name,
        active: user.active,
        createdAt: user.createdAt,
      },
    },
  });
};

/**
 * Saare employees ki list
 */
export const listEmployees = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const search = req.query.search || "";

  // Filter
  const employeeRole = await Role.findOne({ name: "Employee" });

  if (!employeeRole) {
    return res.json({
      success: true,
      data: { items: [], total: 0, page, limit },
    });
  }

  const filter = { roles: employeeRole._id };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate("roles", "name")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((u) => ({
        id: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone,
        roles: u.roles.map((r) => r.name),
        active: u.active,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
};

/**
 * Ek employee ki detail
 */
export const getEmployee = async (req, res) => {
  const user = await User.findById(req.params.id).populate("roles");

  if (!user) {
    fail(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }

  res.json({
    success: true,
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      roles: user.roles.map((r) => ({
        id: String(r._id),
        name: r.name,
        permissions: r.permissions,
      })),
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
};

/**
 * Employee update karo
 */
export const updateEmployee = async (req, res) => {
  const { name, phone, active } = req.body;

  const user = await User.findById(req.params.id);
  if (!user) {
    fail(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }

  // Update
  if (name && name.trim().length >= 2) {
    user.name = name.trim();
  }
  if (phone !== undefined) {
    user.phone = phone || undefined;
  }
  if (typeof active === "boolean") {
    user.active = active;
  }

  await user.save();

  // Audit
  await Audit.create({
    actorId: String(req.user._id),
    action: "employee.update",
    recordId: String(user._id),
    metadata: { changes: { name, phone, active } },
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.json({
    success: true,
    data: {
      message: "Employee updated successfully",
      employee: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        phone: user.phone,
        active: user.active,
      },
    },
  });
};

/**
 * Employee deactivate karo (soft delete)
 */
export const deleteEmployee = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    fail(404, "EMPLOYEE_NOT_FOUND", "Employee not found");
  }

  // Soft delete - active false
  user.active = false;
  await user.save();

  // Saare sessions revoke karo
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  // Audit
  await Audit.create({
    actorId: String(req.user._id),
    action: "employee.delete",
    recordId: String(user._id),
    metadata: { email: user.email },
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  res.json({
    success: true,
    data: { message: "Employee deactivated successfully" },
  });
};