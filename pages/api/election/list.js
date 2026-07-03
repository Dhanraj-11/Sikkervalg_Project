import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { organizationId } = req.body || {};
  if (!organizationId) return res.status(400).json({ error: "Invalid request" });

  const org = await Organization.findOne({ _id: organizationId, ownerId: req.user.id });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  const elections = await Election.find({ organizationId }).sort({ createdAt: -1 }).lean();
  res.json({ elections });
});
