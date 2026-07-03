import connectDB from "@/lib/db";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { name, orgNumber } = req.body || {}; // only these two fields are ever read
  if (!name || !orgNumber) return res.status(400).json({ error: "Invalid request" });
  // `verified` is never client-settable — OP-09 requires it come from an
  // actual Brønnøysundregistrene lookup (not yet wired up), so it defaults
  // to false here regardless of what the request body contains.
  const org = await Organization.create({ name, orgNumber, ownerId: req.user.id, verified: false });
  res.status(201).json(org);
});
