import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import Election from "@/models/Election";
import Candidate from "@/models/Candidate";
import { hashToken } from "@/lib/crypto";

// Public route (no requireAuth) — identity here comes from possession of the
// raw token, never from a session/JWT. BE-21: this is the "blind" entry point;
// it only ever looks up the voters collection, never the ballots collection.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "Invalid link" });

  const voter = await Voter.findOne({ tokenHash: hashToken(token) });
  // BE-19: generic error only — never distinguish "no such token" from
  // "already voted" from "bad format", since that leaks state to an attacker
  // probing tokens.
  if (!voter || voter.hasVoted) return res.status(400).json({ error: "Invalid or already-used link" });
  if (voter.tokenExpiresAt && voter.tokenExpiresAt < new Date())
    return res.status(400).json({ error: "This voting link has expired" });

  const election = await Election.findById(voter.electionId);
  if (!election || election.status !== "ACTIVE")
    return res.status(400).json({ error: "This election is not currently open for voting" });

  const candidates = await Candidate.find({ electionId: voter.electionId }).select("_id name").lean();

  res.json({
    electionName: election.name,
    weight: voter.weight, // FE-10: shown so the voter knows their vote weight, nothing else
    candidates,
  });
}
