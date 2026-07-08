import { parse } from "csv-parse/sync";
import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { encryptEmail } from "@/lib/fle";
import { z } from "zod";

const UploadVotersSchema = z.object({
  electionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid election ID"),
  csv: z.string().min(1, "CSV data cannot be empty"),
});

const CsvRowSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  name: z.string().optional().default(""),
  weight: z.coerce.number().refine((w) => [0.5, 1].includes(w)).default(1),
});

const clean_ = (s) => String(s ?? "").replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ").trim();

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const result = UploadVotersSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  const { electionId, csv } = result.data;

  await connectDB();
  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  if (owned.election.status !== "DRAFT") return res.status(400).json({ error: "Voter roll is locked" });

  let rows;
  try {
    rows = parse(csv, {
      columns: (header) => header.map((h) => clean_(h).toLowerCase()),
      trim: true,
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch (err) {
    return res.status(400).json({ error: `Could not parse CSV: ${err.message}` });
  }
  if (!rows.length) return res.status(400).json({ error: "CSV had no data rows" });

  const invalidRows = [];
  const clean = [];

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const rawEmail = clean_(r.email);
    const rawName = clean_(r.name);
    const rawWeight = clean_(r.weight);

    const parsed = CsvRowSchema.safeParse({ email: rawEmail, name: rawName, weight: rawWeight });
    if (!parsed.success) {
      invalidRows.push({ row: rowNum, email: rawEmail || "(empty)" });
    } else {
      clean.push({
        electionId,
        email: encryptEmail(parsed.data.email),
        name: parsed.data.name.replace(/<[^>]*>/g, "").slice(0, 200),
        weight: parsed.data.weight,
      });
    }
  });

  if (invalidRows.length) {
    return res.status(400).json({
      error: `Invalid email or weight on row${invalidRows.length > 1 ? "s" : ""} ${invalidRows.map((r) => r.row).join(", ")}`,
      invalidRows,
    });
  }

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
