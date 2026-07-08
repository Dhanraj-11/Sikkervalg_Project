import connectDB from "@/lib/db";
import Ballot from "@/models/Ballot";
import Election from "@/models/Election";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { z } from "zod";

const VerifySchema = z.object({
  trackerId: z.string().regex(/^TRK-[0-9A-F]{4}-[0-9A-F]{4}$/, "Invalid tracker ID format"),
});

// OP-21: intentionally public, no credentials — a voter proves nothing about
// who they are, they just prove they hold a tracker ID that's really in the
// ledger. BE-13: only hash-chain fields are exposed, never anything that
// could be joined back to a voter.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (await enforceRateLimit(req, res, "verify-tracker", clientIp(req), { max: 30, windowMs: 10 * 60 * 1000 })) return;

  const result = VerifySchema.safeParse(req.query);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid tracker ID format" });
  }

  await connectDB();
  const { trackerId } = result.data;

  const ballot = await Ballot.findOne({ trackerId }).select("electionId trackerId prevHash hash blank castAt").lean();
  const election = ballot ? await Election.findById(ballot.electionId).select("status").lean() : null;

  if (!ballot || !election || election.status !== "CLOSED") {
    // If not found or not closed, check if there are any active elections.
    // If no active elections exist in the database, return "Tracker ID not found" directly for better UX.
    const activeExists = await Election.exists({ status: "ACTIVE" });
    return res.status(activeExists ? 200 : 404).json({
      found: false,
      message: activeExists 
        ? "Verification isn't available yet — it opens once this election has closed."
        : "Tracker ID not found. Verify the ID or ensure the election is closed.",
    });
  }

  res.json({
    found: true,
    trackerId: ballot.trackerId,
    hash: ballot.hash,
    prevHash: ballot.prevHash,
    castAt: ballot.castAt,
  });
}
