/**
 * Crypto Utilities
 * 
 * Password hashing, token generation, OTP digest, etc.
 */

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

/**
 * Password ko hash karo (bcrypt)
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptRounds);
}

/**
 * Password verify karo
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Random token generate karo (64 chars)
 * Session token ke liye use hoga
 */
export function generateToken() {
  return crypto.randomBytes(48).toString("base64url");
}

/**
 * Token ka SHA-256 digest banao
 * Database mein hash store karenge, plain token nahi
 */
export function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * OTP ka digest banao (challengeId + code ke saath)
 */
export function otpDigest(challengeId, code) {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`${challengeId}:${code}`)
    .digest("hex");
}

/**
 * Random 6-digit OTP generate karo
 */
export function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/**
 * Random hex string generate karo
 */
export function randomHex(bytes = 16) {
  return crypto.randomBytes(bytes).toString("hex");
}