import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Candidate from "@/models/Candidate";
import Committee from "@/models/Committee";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { electionId } = req.body || {};

  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });

  // Once an election is ACTIVE, ballots may already be staged/cast against
  // it — deleting it at that point would either orphan those rows or (if we
  // cascaded) destroy vote data. CLOSED elections carry the final signed
  // protocol. So deletion is only ever safe pre-launch, same boundary every
  // other "election is locked" check in this app already uses.
  if (owned.election.status !== "DRAFT") {
    return res.status(400).json({ error: "Only a DRAFT election can be deleted — close or cancel isn't available once it has started" });
  }

  await Promise.all([
    Candidate.deleteMany({ electionId }),
    Committee.deleteMany({ electionId }),
    Voter.deleteMany({ electionId }),
  ]);
  await Election.deleteOne({ _id: electionId });

  res.json({ deleted: true });
});
