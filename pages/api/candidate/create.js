import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";

// FE-09: strip anything that isn't a letter/number/basic punctuation before
// it ever reaches the DB — a write-in name is rendered as text later, so
// this is what stands between a candidate name and a stored XSS payload.
const sanitizeName = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N} .,'\-]/gu, "").trim().slice(0, 100);

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { electionId, name } = req.body || {}; // only these two fields are ever read (no mass-assignment)
  const cleanName = sanitizeName(name);
  if (!cleanName) return res.status(400).json({ error: "Invalid request" });

  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });

  // BE-18: nominee array is immutable once voting has started (or ended) —
  // only DRAFT elections accept candidate changes.
  if (owned.election.status !== "DRAFT") return res.status(400).json({ error: "Candidates are locked once the election is active" });

  const candidate = await Candidate.create({ electionId, name: cleanName });
  res.status(201).json(candidate);
});
