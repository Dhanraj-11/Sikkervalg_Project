import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import Committee from "@/models/Committee";
import Voter from "@/models/Voter";
import Organization from "@/models/Organization";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";

// Single round trip that reconstructs the full dashboard workspace state for
// an election the HR user already owns — this is what makes "continue this
// election" after a page refresh actually resume where you left off, instead
// of the frontend having to re-derive everything from a chain of local state
// that a refresh just wiped.
export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const owned = await loadOwnedElection(req.body.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  const { election } = owned;
  const electionId = election._id;

  const [org, candidates, committee, votersTotal, votersLinkSent] = await Promise.all([
    Organization.findById(election.organizationId).lean(),
    Candidate.find({ electionId }).sort({ createdAt: 1 }).lean(),
    Committee.find({ electionId }).select("email approved approvedAt -_id").sort({ createdAt: 1 }).lean(),
    Voter.countDocuments({ electionId }),
    Voter.countDocuments({ electionId, linkSentAt: { $ne: null } }),
  ]);

  res.json({
    election,
    org,
    candidates,
    committee,
    votersTotal,
    votersLinkSent,
  });
});
