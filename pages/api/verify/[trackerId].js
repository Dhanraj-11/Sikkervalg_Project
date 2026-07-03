import connectDB from "@/lib/db";
import Ballot from "@/models/Ballot";
import Election from "@/models/Election";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

// OP-21: intentionally public, no credentials — a voter proves nothing about
// who they are, they just prove they hold a tracker ID that's really in the
// ledger. BE-13: only hash-chain fields are exposed, never anything that
// could be joined back to a voter.
//
// Verification is fully inactive until the election closes — not even a
// "yes it's recorded" reassurance. This is deliberate: revealing anything
// (including a bare "found") while voting is still open would let anyone
// repeatedly probe this endpoint to build a live running count of how many
// people have voted so far, or to test guesses at valid tracker IDs before
// the roll is final. So the response is identical — real tracker ID or
// not — for the entire time the election is open.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (await enforceRateLimit(req, res, "verify-tracker", clientIp(req), { max: 30, windowMs: 10 * 60 * 1000 })) return;
  await connectDB();
  const { trackerId } = req.query;

  const ballot = await Ballot.findOne({ trackerId }).select("electionId trackerId prevHash hash blank castAt").lean();

  const election = ballot ? await Election.findById(ballot.electionId).select("status").lean() : null;

  if (!ballot || !election || election.status !== "CLOSED") {
    // Same response whether the ID is real-but-not-closed-yet, real-but-not-
    // flushed-yet, or simply wrong — no branch here should let a caller
    // distinguish those cases.
    return res.status(200).json({
      found: false,
      message: "Verification isn't available yet — it opens once this election has closed.",
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
