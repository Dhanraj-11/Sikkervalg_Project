import jwt from "jsonwebtoken";
import connectDB from "@/lib/db";
import Committee from "@/models/Committee";
import Election from "@/models/Election";
import User from "@/models/User";
import { hashPw, checkPw, signToken, validatePassword } from "@/lib/auth";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { hashToken } from "@/lib/crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (await enforceRateLimit(req, res, "committee-join", clientIp(req), { max: 10, windowMs: 60 * 60 * 1000 })) return;

  await connectDB();
  const { token: rawToken, name, password } = req.body || {};
  if (!rawToken) return res.status(400).json({ error: "Invalid request" });

  // Looked up by the hash of a 256-bit token that only ever existed in the
  // invite email — not by the Committee document's own _id, which is
  // guessable-ish (embeds a timestamp) and was previously exposed back to
  // the HR admin's dashboard. Possessing the emailed link is what proves
  // this is really the invited person.
  const committee = await Committee.findOne({ tokenHash: hashToken(rawToken) });
  if (!committee) return res.status(404).json({ error: "Invalid invite" });
  if (committee.userId) return res.status(400).json({ error: "This invite has already been used" });

  // Committee members exist to approve the roll/candidates before voting
  // opens — once the election has moved past DRAFT (active or closed), an
  // invite link is no longer meaningful. Same "locked once it starts"
  // boundary already used for candidates/voter roll uploads.
  const election = await Election.findById(committee.electionId).select("status").lean();
  if (!election || election.status !== "DRAFT") {
    return res.status(400).json({ error: "This election has already started — committee invites are no longer valid" });
  }

  // Case 1: the invite was opened while already signed in (e.g. an HR admin
  // clicking their own committee invite, or someone who already joined a
  // different election's committee with this same email). Link the invite
  // to that existing, already-authenticated account — no password needed,
  // and no attempt to create a second User row for the same email.
  const bearer = req.headers.authorization?.split(" ")[1];
  if (bearer) {
    try {
      const payload = jwt.verify(bearer, process.env.JWT_SECRET);
      const existingUser = await User.findById(payload.id);
      if (existingUser && existingUser.email === committee.email) {
        committee.userId = existingUser._id;
        await committee.save();
        return res.status(200).json({ token: signToken(existingUser), electionId: committee.electionId });
      }
    } catch {
      // invalid/expired token — fall through to the anonymous flow below
    }
  }

  // Case 2: anonymous join with a password. If a User with this email
  // already exists (same scenario as above, just not currently logged in),
  // verify the password instead of failing with a duplicate-key error —
  // that proves ownership of the existing account and links it.
  if (!password) return res.status(400).json({ error: "Invalid request" });
  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const existingByEmail = await User.findOne({ email: committee.email });
  if (existingByEmail) {
    const ok = await checkPw(password, existingByEmail.password);
    if (!ok) {
      return res.status(409).json({
        error: "An account with this email already exists. Log in with that account, then reopen this invite link.",
      });
    }
    committee.userId = existingByEmail._id;
    await committee.save();
    return res.status(200).json({ token: signToken(existingByEmail), electionId: committee.electionId });
  }

  try {
    const user = await User.create({ name, email: committee.email, password: await hashPw(password), role: "committee" });
    committee.userId = user._id;
    await committee.save();
    res.status(201).json({ token: signToken(user), electionId: committee.electionId });
  } catch (err) {
    // Race: two requests hit the "no existing user" branch at once. Whoever
    // loses now genuinely needs to retry rather than being told to log in
    // with a password they haven't set yet.
    if (err.code === 11000) return res.status(409).json({ error: "That was just claimed by another request — please try again" });
    res.status(500).json({ error: "Unable to complete signup" });
  }
}
