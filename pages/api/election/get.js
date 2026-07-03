import connectDB from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const owned = await loadOwnedElection(req.body.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" }); // same message whether missing or not yours — don't confirm existence to non-owners
  res.json(owned.election);
});
