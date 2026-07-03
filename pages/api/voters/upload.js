import { parse } from "csv-parse/sync";
import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { encryptEmail } from "@/lib/fle";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strips characters that are invisible in a textarea but break regex/DB
// matching: zero-width space/joiner, BOM, and non-breaking space (which
// looks identical to a normal space when pasted from a browser/chat app).
const clean_ = (s) => String(s ?? "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").trim();

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { electionId, csv } = req.body || {}; // csv: raw text with headers email,name,weight
  if (!csv) return res.status(400).json({ error: "Invalid request" });

  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  // Spec (Phase 1.4): roll compilation is only allowed pre-activation — once
  // multi-sig flips status to ACTIVE, the collection is immutable.
  if (owned.election.status !== "DRAFT") return res.status(400).json({ error: "Voter roll is locked" });

  let rows;
  try {
    rows = parse(csv, {
      columns: (header) => header.map((h) => clean_(h).toLowerCase()),
      trim: true,
      bom: true,
      skip_empty_lines: true, // a trailing blank line from a textarea paste shouldn't be a hard failure
      relax_column_count: true, // tolerate a stray trailing comma rather than throwing
    });
  } catch (err) {
    return res.status(400).json({ error: `Could not parse CSV: ${err.message}` });
  }
  if (!rows.length) return res.status(400).json({ error: "CSV had no data rows" });

  // Report exactly which row(s) are the problem instead of a blanket
  // rejection — row numbers are 1-indexed and count the header row, so they
  // line up with what the person sees if they open this in a spreadsheet.
  const invalidRows = [];
  const clean = rows
    .map((r, i) => ({ i, email: clean_(r.email).toLowerCase(), name: clean_(r.name), weight: clean_(r.weight) }))
    .filter((r) => {
      const ok = EMAIL_RE.test(r.email);
      if (!ok) invalidRows.push({ row: r.i + 2, email: r.email || "(empty)" });
      return ok;
    })
    .map((r) => ({
      electionId,
      email: encryptEmail(r.email),
      name: r.name.replace(/<[^>]*>/g, "").slice(0, 200), // FE-09-style scrub, same rationale as candidate names
      weight: [0.5, 1].includes(Number(r.weight)) ? Number(r.weight) : 1, // BE-04: only statutory values allowed
    }));

  if (invalidRows.length) {
    return res.status(400).json({
      error: `Invalid email on row${invalidRows.length > 1 ? "s" : ""} ${invalidRows.map((r) => r.row).join(", ")}`,
      invalidRows,
    });
  }

  // Encryption is deterministic (lib/fle.js), so duplicate emails — either
  // repeated within this CSV, or already present from a prior upload —
  // produce identical ciphertext and can be caught before insert. Without
  // this, the same person could end up with two Voter rows and two tokens.
  const seen = new Set();
  const deduped = clean.filter((v) => (seen.has(v.email) ? false : (seen.add(v.email), true)));
  const existing = await Voter.find({ electionId, email: { $in: deduped.map((v) => v.email) } })
    .select("email")
    .lean();
  const existingSet = new Set(existing.map((v) => v.email));
  const toInsert = deduped.filter((v) => !existingSet.has(v.email));

  const voters = toInsert.length ? await Voter.insertMany(toInsert) : [];
  res.status(201).json({
    count: voters.length,
    skippedDuplicates: rows.length - toInsert.length,
  });
});
