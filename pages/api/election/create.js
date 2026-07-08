import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Organization from "@/models/Organization";
import Committee from "@/models/Committee";
import User from "@/models/User";
import { requireAuth } from "@/lib/auth";
import { generateToken, hashToken } from "@/lib/crypto";
import { sendMail } from "@/lib/email";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const { organizationId, name, type, startTime, endTime } = req.body || {};
  if (!organizationId || !name) return res.status(400).json({ error: "Invalid request" });

  const org = await Organization.findOne({ _id: organizationId, ownerId: req.user.id });
  if (!org) return res.status(404).json({ error: "Organization not found" });

  // Only these fields are ever accepted from the client — status, tally,
  // rollHash, ledgerHead, and every protocol* field are server-owned and
  // must never be settable at creation (or ever, from a route).
  const election = await Election.create({ organizationId, name, type, startTime, endTime });

  // HR is invited to their own election's committee the exact same way any
  // other member is: a real invite row + a real join link, no special-cased
  // auto-approval. committee/approve.js's 3-approval threshold is untouched —
  // HR still has to click join and then approve, same as everyone else. This
  // deliberately does NOT reduce the independence guarantee the way an
  // auto-approved seat would have.
  const owner = await User.findById(req.user.id).select("email").lean();
  const rawToken = generateToken();
  await Committee.create({
    electionId: election._id,
    email: owner.email,
    tokenHash: hashToken(rawToken),
  });
  const base = process.env.APP_URL || "http://localhost:3000";
  await sendMail(
    owner.email,
    "You've been invited to a SikkerValg election committee",
    `<p>Join here: <a href="${base}/committee/join?token=${rawToken}">${base}/committee/join?token=${rawToken}</a></p>`
  );

  res.status(201).json(election);
});
