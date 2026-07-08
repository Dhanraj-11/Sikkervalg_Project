import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import Ballot from "@/models/Ballot";
import Voter from "@/models/Voter";
import Election from "@/models/Election";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { flushPendingBallots } from "@/lib/ballotFlush";
import { rollHash } from "@/lib/crypto";
import mongoose from "mongoose";
import { z } from "zod";

// Zod validation for request body
const CloseSchema = z.object({
  electionId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid election ID"),
});

// BE-12: once CLOSED, no route in this app ever exposes live/partial totals.
// This is the single place a tally is computed, and it's computed exactly once.
export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const result = CloseSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: "Invalid request data", details: result.error.format() });
  }

  await connectDB();
  const owned = await loadOwnedElection(result.data.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });

  const { election } = owned;
  const electionId = election._id;
  if (election.status === "CLOSED") return res.status(400).json({ error: "Election already closed" });

  const session = await mongoose.startSession();
  try {
    let tallyResults;
    let ledgerHead;

    await session.withTransaction(async () => {
      // Atomically change status to CLOSED to lock out concurrent votes
      const closedElection = await Election.findOneAndUpdate(
        { _id: electionId, status: "ACTIVE" },
        { $set: { status: "CLOSED", closedAt: new Date() } },
        { session, new: true }
      );
      if (!closedElection) throw new Error("ELECTION_NOT_ACTIVE_OR_CLOSED");

      // Sweep staged votes into the main Ballot chain inside the transaction
      await flushPendingBallots(electionId, session);

      const ballots = await Ballot.find({ electionId }).session(session).sort({ _id: 1 }).lean();
      const candidates = await Candidate.find({ electionId }).session(session).lean();

      // Weighted tally per candidate + blank
      const totals = new Map(candidates.map((c) => [String(c._id), { name: c.name, weight: 0, count: 0 }]));
      let blank = { weight: 0, count: 0 };

      for (const b of ballots) {
        if (b.blank) {
          blank.weight += b.weight;
          blank.count += 1;
        } else {
          const key = String(b.candidateId);
          const t = totals.get(key);
          if (t) {
            t.weight += b.weight;
            t.count += 1;
          }
        }
      }

      // BE-05: if a tally bucket contains exactly one 0.5-weight ballot, it's
      // rounded up to prevent identification of voter choices.
      const deAnonRisk = [];
      function guard(bucketName, bucket) {
        if (bucket.count === 1 && bucket.weight === 0.5) {
          bucket.weight = 1.0;
          deAnonRisk.push(bucketName);
        }
      }
      guard("blank", blank);
      for (const [key, t] of totals) guard(t.name, t);

      const results = [...totals.values(), { name: "Blank stemme", weight: blank.weight, count: blank.count }];
      ledgerHead = ballots.length ? ballots[ballots.length - 1].hash : null;

      // BE-25: prove the roll wasn't touched while ACTIVE
      const currentVoters = await Voter.find({ electionId }).session(session).select("_id weight").lean();
      const rollIntact = !election.rollHash || rollHash(currentVoters) === election.rollHash;

      closedElection.tally = { results, totalBallots: ballots.length, deAnonRiskAdjusted: deAnonRisk, rollIntact };
      closedElection.ledgerHead = ledgerHead;
      await closedElection.save({ session });

      tallyResults = closedElection.tally;
    });

    res.json({ tally: tallyResults, ledgerHead });
  } catch (err) {
    if (err.message === "ELECTION_NOT_ACTIVE_OR_CLOSED") {
      return res.status(400).json({ error: "Election already closed or not active" });
    }
    res.status(500).json({ error: "Unable to close election" });
  } finally {
    session.endSession();
  }
});
