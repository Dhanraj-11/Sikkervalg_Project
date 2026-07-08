import connectDB from "@/lib/db";
import Committee from "@/models/Committee";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { sendMail } from "@/lib/email";
import { generateToken, hashToken } from "@/lib/crypto";
import { z } from "zod";

const InviteCommitteeSchema = z.object({
  electionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid election ID"),
  emails: z.array(z.string().email("Invalid email format")).min(1, "Must invite at least one email"),
});

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const result = InviteCommitteeSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  const { electionId, emails } = result.data;

  await connectDB();
  const owned = await loadOwnedElection(electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  if (owned.election.status !== "DRAFT") return res.status(400).json({ error: "Committee is locked once the election is active" });

  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
  if (!clean.length) return res.status(400).json({ error: "Invalid request" });

  const already = await Committee.find({ electionId, email: { $in: clean } }).select("email").lean();
  const alreadySet = new Set(already.map((c) => c.email));
  const toInvite = clean.filter((e) => !alreadySet.has(e));

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

  res.status(201).json({
    invited: members.map((m) => ({ email: m.email, approved: m.approved })),
    skipped: clean.length - toInvite.length,
  });
});
