import connectDB from "@/lib/db";
import Committee from "@/models/Committee";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { sendMail } from "@/lib/email";
import { generateToken, hashToken } from "@/lib/crypto";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { electionId, emails } = req.body || {}; // emails: string[]
  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  if (owned.election.status !== "DRAFT") return res.status(400).json({ error: "Committee is locked once the election is active" });

  const clean = [...new Set((emails || []).map((e) => String(e).trim().toLowerCase()))].filter((e) => EMAIL_RE.test(e));
  if (!clean.length) return res.status(400).json({ error: "Invalid request" });

  // Skip anyone already invited to this election rather than letting the
  // whole batch fail on the (electionId, email) unique index — re-running
  // an invite CSV with overlapping emails should just no-op the repeats.
  const already = await Committee.find({ electionId, email: { $in: clean } }).select("email").lean();
  const alreadySet = new Set(already.map((c) => c.email));
  const toInvite = clean.filter((e) => !alreadySet.has(e));

  // Each invite gets its own 256-bit random token (same primitive as voter
  // ballot links). Only the hash is stored — the raw token exists only in
  // the outbound email and is the sole way to claim this seat. Deliberately
  // NOT the Mongo _id: an _id is low-entropy (embeds a timestamp) and, worse,
  // was previously visible to the HR admin via election/summary.js — letting
  // HR claim other members' committee seats and single-handedly activate an
  // election meant to require three independent approvals.
  const rawTokens = toInvite.map(() => generateToken());
  const members = toInvite.length
    ? await Committee.insertMany(
        toInvite.map((email, i) => ({ electionId, email, tokenHash: hashToken(rawTokens[i]) }))
      )
    : [];
  const base = process.env.APP_URL || "http://localhost:3000";
  await Promise.all(
    members.map((m, i) =>
      sendMail(
        m.email,
        "You've been invited to a SikkerValg election committee",
        `<p>Join here: <a href="${base}/committee/join?token=${rawTokens[i]}">${base}/committee/join?token=${rawTokens[i]}</a></p>`
      )
    )
  );
  // Only echo back what the dashboard needs to render — never the tokenHash.
  res.status(201).json({
    invited: members.map((m) => ({ email: m.email, approved: m.approved })),
    skipped: clean.length - toInvite.length,
  });
});
