import connectDB from "@/lib/db";
import Election from "@/models/Election";
import { flushPendingBallots } from "@/lib/ballotFlush";
import { timingSafeEqual } from "@/lib/auth";

// BE-03: runs every few minutes (see vercel.json) so a staged vote is never
// held so long that a slow-trickling election looks suspicious, but never so
// immediate that it defeats the point of decoupling from the cast instant.
export default async function handler(req, res) {
  if (!timingSafeEqual(req.headers.authorization, `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).end();
  await connectDB();

  const active = await Election.find({ status: "ACTIVE" }).select("_id");
  let flushed = 0;
  for (const e of active) {
    const result = await flushPendingBallots(e._id);
    flushed += result.flushed;
  }
  res.json({ electionsChecked: active.length, ballotsFlushed: flushed });
}
