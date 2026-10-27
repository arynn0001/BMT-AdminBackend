/**
 * Auth Routes
 */

import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { authenticate, hasRole } from "../middleware/auth.js";

const router = Router();

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

// Admin signup (first user)
router.post("/signup", authController.signup);

// Login (admin + employee)
router.post("/login", authController.login);

/* =========================================================
   PROTECTED ROUTES
   ========================================================= */

// Current user
router.get("/me", authenticate, authController.me);

// Logout
router.post("/logout", authenticate, authController.logout);

/* =========================================================
   EMPLOYEE MANAGEMENT (Admin only)
   ========================================================= */

router.post(
  "/employees",
  authenticate,
  hasRole("Admin"),
  authController.createEmployee
);

router.get(
  "/employees",
  authenticate,
  hasRole("Admin"),
  authController.listEmployees
);

router.get(
  "/employees/:id",
  authenticate,
  hasRole("Admin"),
  authController.getEmployee
);

router.put(
  "/employees/:id",
  authenticate,
  hasRole("Admin"),
  authController.updateEmployee
);

router.delete(
  "/employees/:id",
  authenticate,
  hasRole("Admin"),
  authController.deleteEmployee
);

/* =========================================================
   HEALTH
   ========================================================= */

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "Auth routes ready" });
});

export default router;