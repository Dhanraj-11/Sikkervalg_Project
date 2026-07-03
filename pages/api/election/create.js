import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { organizationId, name, type, startTime, endTime } = req.body || {};
  if (!organizationId || !name) return res.status(400).json({ error: "Invalid request" });

  const org = await Organization.findOne({ _id: organizationId, ownerId: req.user.id });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  // Only these fields are ever accepted from the client — status, tally,
  // rollHash, ledgerHead, and every protocol* field are server-owned and
  // must never be settable at creation (or ever, from a route).
  const election = await Election.create({ organizationId, name, type, startTime, endTime });
  res.status(201).json(election);
});
