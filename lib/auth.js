import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import connectDB from "@/lib/db";
import User from "@/models/User";

export const hashPw = (pw) => bcrypt.hash(pw, 10);
export const checkPw = (pw, hash) => bcrypt.compare(pw, hash);

// A short, easily-guessed list — this is a floor, not a full breach-check
// (HaveIBeenPwned's k-anonymity API is the better long-term answer). It
// exists mainly to block the handful of passwords that appear in almost
// every credential-stuffing wordlist.
const MIN_PASSWORD_LENGTH = 10;
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789",
  "1234567890", "qwerty123", "qwertyuiop", "letmein123", "welcome123",
  "iloveyou1", "admin1234", "administrator", "changeme123",
]);

// Returns null if the password is acceptable, or a user-facing message if not.
export function validatePassword(pw) {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Password must contain both letters and numbers";
  }
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return "That password is too common — please choose another";
  }
  return null;
}

// Committee/HR accounts control real elections, so tokens carry a
// tokenVersion snapshot. Bumping User.tokenVersion (password change, admin
// "log out everywhere") invalidates every outstanding token immediately,
// without needing a separate revocation-list store.
export const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

export function requireAuth(handler) {
  return async (req, res) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const payload = jwt.verify(token, process.env.JWT_SECRET);

      await connectDB();
      const user = await User.findById(payload.id).select("tokenVersion").lean();
      if (!user || (payload.tokenVersion || 0) !== (user.tokenVersion || 0)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      req.user = payload;
      return handler(req, res);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

// Constant-time string comparison for secrets (cron bearer token, etc.), so
// an attacker can't use response-time differences to guess the secret
// character-by-character. `!==` on strings short-circuits at the first
// mismatched byte, which is a real (if slow) timing side-channel for a
// value like CRON_SECRET that's compared on every invocation.
export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // burn equivalent time either way
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
