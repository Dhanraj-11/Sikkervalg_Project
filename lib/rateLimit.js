import mongoose from "mongoose";
import connectDB from "./db";

// Fixed-window counter backed by Mongo instead of in-memory state, because
// serverless functions don't share memory across invocations/instances — an
// in-process Map would let an attacker just get routed to a fresh instance.
// TTL index means the collection self-cleans; no separate cron needed.
const RateLimitSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimit = mongoose.models.RateLimit || mongoose.model("RateLimit", RateLimitSchema);

/**
 * @param {string} bucket - logical action name, e.g. "login"
 * @param {string} identity - e.g. caller IP, or IP+email
 * @param {{max: number, windowMs: number}} opts
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
export async function rateLimit(bucket, identity, { max, windowMs }) {
  await connectDB();
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${bucket}:${identity}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowMs);

  const doc = await RateLimit.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, new: true }
  );

  return { allowed: doc.count <= max, remaining: Math.max(0, max - doc.count) };
}

// Best-effort client IP for serverless (Vercel sets x-forwarded-for).
// Not spoof-proof by itself, but combined with a per-account limit and
// bcrypt's inherent cost, it's enough to blunt casual brute-forcing.
export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

// Sends a 429 and returns true if the caller should stop; returns false
// (and does nothing) if the request is within its limit.
export async function enforceRateLimit(req, res, bucket, identity, opts) {
  const { allowed } = await rateLimit(bucket, identity, opts);
  if (!allowed) {
    res.status(429).json({ error: "Too many requests — please try again later" });
    return true;
  }
  return false;
}
