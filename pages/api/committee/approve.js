import connectDB from "@/lib/db";
import Committee from "@/models/Committee";
import Election from "@/models/Election";
import Candidate from "@/models/Candidate";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { rollHash } from "@/lib/crypto";

const MIN_CANDIDATES = 2;
const MIN_VOTERS = 1;

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { electionId } = req.body || {};
  if (!electionId) return res.status(400).json({ error: "Invalid request" });

  const membership = await Committee.findOne({ electionId, userId: req.user.id });
  if (!membership) return res.status(403).json({ error: "Not a committee member for this election" });

  const election = await Election.findById(electionId);
  if (!election) return res.status(404).json({ error: "Election not found" });
  if (election.status !== "DRAFT") return res.status(400).json({ error: "This election has already started or closed" });

  // Block the approval itself (not just activation) so the committee can't
  // sign off on an election that isn't actually votable yet — a clearer
  // signal to the HR admin than "3 people approved but nothing happened."
  const [candidateCount, voterCount] = await Promise.all([
    Candidate.countDocuments({ electionId }),
    Voter.countDocuments({ electionId }),
  ]);
  if (candidateCount < MIN_CANDIDATES) {
    return res.status(400).json({ error: `Election needs at least ${MIN_CANDIDATES} candidates before it can be approved` });
  }
  if (voterCount < MIN_VOTERS) {
    return res.status(400).json({ error: `Election needs at least ${MIN_VOTERS} voter on the roll before it can be approved` });
  }

  if (!membership.approved) {
    await Committee.updateOne({ _id: membership._id }, { approved: true, approvedAt: new Date() });
  }
  const approvedCount = await Committee.countDocuments({ electionId, approved: true });

  if (approvedCount >= 3) {
    // BE-25: fingerprint the roll at the exact moment it locks, so a later
    // tally can prove nobody touched the Voter collection while ACTIVE.
    const voters = await Voter.find({ electionId }).select("_id weight").lean();
    await Election.updateOne({ _id: electionId }, { status: "ACTIVE", rollHash: rollHash(voters) });
  }

  res.json({ approvedCount, active: approvedCount >= 3 });
});
