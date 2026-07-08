import connectDB from "@/lib/db";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { name, orgNumber } = req.body || {}; // only these two fields are ever read
  if (!name || !orgNumber) return res.status(400).json({ error: "Invalid request" });

  // Policy: one HR user may own exactly one organization. Checked here for
  // a clean error message; also enforced as a unique index on
  // Organization.ownerId (models/Organization.js) so it can't be bypassed
  // by two simultaneous requests racing past this check.
  const existing = await Organization.findOne({ ownerId: req.user.id });
  if (existing) {
    return res.status(409).json({ error: "You already have an organization. Each HR account may only create one." });
  }

  // `verified` is never client-settable — OP-09 requires it come from an
  // actual Brønnøysundregistrene lookup (not yet wired up), so it defaults
  // to false here regardless of what the request body contains.
  try {
    const org = await Organization.create({ name, orgNumber, ownerId: req.user.id, verified: false });
    res.status(201).json(org);
  } catch (err) {
    // E11000 duplicate key — the race-condition case the findOne above
    // couldn't catch (two requests arriving at nearly the same instant).
    if (err.code === 11000) {
      return res.status(409).json({ error: "You already have an organization. Each HR account may only create one." });
    }
    throw err;
  }
});
