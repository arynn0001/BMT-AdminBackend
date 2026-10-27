/**
 * Auth Middleware
 * 
 * JWT verify + Role-based permission check.
 */

import { User, Session } from "../models/system.js";
import { digest } from "../utils/crypto.js";
import { fail } from "../utils/response.js";

/**
 * Authenticate - JWT token verify
 */
export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return fail(401, "AUTHENTICATION_REQUIRED", "A valid bearer session is required");
    }

    const token = authHeader.substring(7);
    if (!token) {
      return fail(401, "AUTHENTICATION_REQUIRED", "A valid bearer session is required");
    }

    const tokenHash = digest(token);
    const session = await Session.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return fail(401, "INVALID_SESSION", "Session expired or invalid");
    }

    const user = await User.findById(session.userId).populate("roles");

    if (!user || !user.active) {
      return fail(401, "ACCOUNT_DISABLED", "Account unavailable");
    }

    session.lastSeen = new Date();
    await session.save();

    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Permission check
 * Usage: permits("vendors:read")
 */
export function permits(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      return fail(401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }

    const has = req.user.roles.some((role) =>
      role.permissions.includes("*:*") || role.permissions.includes(permission)
    );

    if (!has) {
      return fail(403, "FORBIDDEN", `Permission denied: ${permission} required`);
    }

    next();
  };
}

/**
 * Role check
 * Usage: hasRole("Admin")
 */
export function hasRole(roleName) {
  return (req, _res, next) => {
    if (!req.user) {
      return fail(401, "AUTHENTICATION_REQUIRED", "Authentication required");
    }

    const has = req.user.roles.some((r) => r.name === roleName);

    if (!has) {
      return fail(403, "FORBIDDEN", `Role required: ${roleName}`);
    }

    next();
  };
}