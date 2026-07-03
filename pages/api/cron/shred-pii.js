import connectDB from "@/lib/db";
import Election from "@/models/Election";
import Voter from "@/models/Voter";
import { timingSafeEqual } from "@/lib/auth";

// BE-15. Triggered by Vercel Cron (see vercel.json) — no custom scheduler
// needed. Voter rows aren't deleted outright (hasVoted/weight stay for
// historical audit counts); only the fields that identify a person are wiped.
export default async function handler(req, res) {
  if (!timingSafeEqual(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).end();
  await connectDB();

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await Election.find({ status: "CLOSED", closedAt: { $lte: cutoff } }).select("_id");

  const result = await Voter.updateMany(
    { electionId: { $in: stale.map((e) => e._id) }, email: { $ne: null } },
    { $set: { email: null, name: null, tokenHash: null } }
  );

  res.json({ electionsProcessed: stale.length, votersShredded: result.modifiedCount });
}
