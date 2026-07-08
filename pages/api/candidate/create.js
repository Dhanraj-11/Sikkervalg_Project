import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";

// FE-09: strip anything that isn't a letter/number/basic punctuation before
// it ever reaches the DB — a write-in name is rendered as text later, so
// this is what stands between a candidate name and a stored XSS payload.
const sanitizeName = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N} .,'\-]/gu, "").trim().slice(0, 100);

// Escapes regex special characters so a candidate name like "O'Brien (Jr.)"
// is matched literally, not interpreted as a pattern.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

  const nameNormalized = cleanName.toLowerCase();

  // Primary check — matches against the actual `name` field with a
  // case-insensitive regex, not the nameNormalized field. This is
  // deliberate: nameNormalized only exists on rows created after this fix,
  // so checking against it alone would miss a duplicate against any
  // pre-existing candidate row. Matching on `name` catches duplicates
  // regardless of when the existing row was created.
  const existing = await Candidate.findOne({
    electionId,
    name: { $regex: `^${escapeRegex(cleanName)}$`, $options: "i" },
  });
  if (existing) {
    return res.status(409).json({ error: `"${cleanName}" is already on the ballot for this election` });
  }

  try {
    const candidate = await Candidate.create({ electionId, name: cleanName, nameNormalized });
    res.status(201).json(candidate);
  } catch (err) {
    // Backstop for the race-condition case (two requests arriving at nearly
    // the same instant, both passing the findOne check above) — only bites
    // once the index has successfully built on clean data.
    if (err.code === 11000) {
      return res.status(409).json({ error: `"${cleanName}" is already on the ballot for this election` });
    }
    throw err;
  }
});
