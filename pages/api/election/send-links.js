import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { generateToken, hashToken } from "@/lib/crypto";
import { decryptEmail } from "@/lib/fle";
import { sendMail } from "@/lib/email";

export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const owned = await loadOwnedElection(req.body.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  const { election } = owned;
  const electionId = election._id;
  if (election.status !== "ACTIVE")
    return res.status(400).json({
      error: "Election must be ACTIVE (all 3 committee approvals submitted) before voting links can be sent",
    });

  const voters = await Voter.find({ electionId, hasVoted: false });
  const expiresAt = election.endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  let sent = 0;
  for (const voter of voters) {
    const token = generateToken();
    voter.tokenHash = hashToken(token);
    voter.tokenExpiresAt = expiresAt;
    voter.linkSentAt = new Date();
    await voter.save();
    const link = `${process.env.APP_URL || "http://localhost:3000"}/vote/${token}`;
    const verifyLink = `${process.env.APP_URL || "http://localhost:3000"}/verify`;
    await sendMail(
      decryptEmail(voter.email),
      "Your SikkerValg voting link",
      `<p>Cast your vote: <a href="${link}">${link}</a></p>
       <p>After voting, you'll be shown a one-time tracker ID. Save it — once this election has closed, you can use it at <a href="${verifyLink}">${verifyLink}</a> to confirm your ballot was counted (this never reveals who or what you voted for).</p>`
    );
    sent++;
  }

  res.json({ sent });
});
