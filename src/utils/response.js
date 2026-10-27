/**
 * Standard API Response Format
 * 
 * Har API response is format mein hoga:
 * Success: { success: true, data: {...} }
 * Error:   { success: false, error: { code, message } }
 */

/**
 * Success response bhejo
 */
export function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Error response bhejo
 */
export function error(res, statusCode, code, message, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Custom App Error class - throw karne ke liye
 */
export class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error throw karo - simple syntax
 * 
 * Example: throw fail(404, "NOT_FOUND", "User not found")
 */
export function fail(statusCode, code, message, details = null) {
  throw new AppError(statusCode, code, message, details);
}