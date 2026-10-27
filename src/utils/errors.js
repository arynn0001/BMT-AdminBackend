/**
 * Global Error Handler Middleware
 * 
 * Express mein jo bhi error throw hota hai, wo yaha aata hai.
 * Ye consistent format mein response bhejta hai.
 */

import { logger } from "./logger.js";
import { AppError } from "./response.js";

export function errorHandler(err, req, res, next) {
  // Agar response already bhej diya gaya hai
  if (res.headersSent) {
    return next(err);
  }

  // AppError (hamara custom error)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
        requestId: req.id,
      },
    });
  }

  // Zod validation error
  if (err.name === "ZodError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.errors,
        requestId: req.id,
      },
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err.message,
        requestId: req.id,
      },
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      error: {
        code: "DUPLICATE_KEY",
        message: `${field} already exists`,
        requestId: req.id,
      },
    });
  }

  // Unknown error - log karo aur generic message bhejo
  logger.error({ err, requestId: req.id }, "Unhandled error");

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
      requestId: req.id,
    },
  });
}