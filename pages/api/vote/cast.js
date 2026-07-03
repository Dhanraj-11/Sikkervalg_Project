import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import Election from "@/models/Election";
import Candidate from "@/models/Candidate";
import BallotStaging from "@/models/BallotStaging";
import { hashToken, generateTrackerId } from "@/lib/crypto";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";

// This is the heart of BE-01/BE-06/BE-21: token consumption (identity side)
// and ballot creation (choice side) happen inside one MongoDB transaction,
// but write to two collections that share no linking field. If anything
// fails, the whole transaction rolls back — a voter can never end up
// "consumed" without a ballot existing, or vice versa.
//
// BE-03: the ballot side writes to BallotStaging, not the real Ballot chain.
// Writing to the real, publicly-auditable ledger at this exact instant would
// let anyone watching the database correlate this Voter update with the new
// Ballot row purely by timestamp. A separate periodic job moves staged
// ballots into the real chain later, in shuffled batches — see
// lib/ballotFlush.js.
//
// NOTE: multi-document transactions require MongoDB running as a replica set
// (Atlas gives you this by default; a bare standalone `mongod` does not).
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Tokens are 256-bit random, so brute force is infeasible either way —
  // this is mainly a backstop against scripted spam/DoS hammering the
  // transaction path (each attempt opens a Mongo session).
  if (await enforceRateLimit(req, res, "vote-cast", clientIp(req), { max: 30, windowMs: 10 * 60 * 1000 })) return;

  await connectDB();
  const { token, candidateId, blank, website } = req.body || {};
  if (website) {
    // FE-15: hidden field only a bot/extension would fill in. Log for
    // monitoring, reject with the same generic message real errors use —
    // never reveal that honeypot detection exists.
    console.warn("[honeypot] blocked vote submission with filled trap field");
    return res.status(400).json({ error: "Unable to record vote" });
  }
  if (!token || (!candidateId && !blank)) return res.status(400).json({ error: "Invalid request" });

  const session = await mongoose.startSession();
  try {
    let trackerId;

    // BE-22: tight timeouts so a dropped serverless connection rolls back
    // cleanly instead of leaving the transaction open.
    await session.withTransaction(
      async () => {
        // BE-06: atomic find+consume. If another request already consumed this
        // token between page-load and submit, this simply matches nothing.
        const voter = await Voter.findOneAndUpdate(
          { tokenHash: hashToken(token), hasVoted: false, tokenExpiresAt: { $gt: new Date() } },
          { $set: { hasVoted: true }, $unset: { tokenHash: "" } },
          { session, new: true }
        );
        if (!voter) throw new Error("INVALID_TOKEN");

        const election = await Election.findById(voter.electionId).session(session);
        if (!election || election.status !== "ACTIVE") throw new Error("ELECTION_NOT_ACTIVE");

        let candidateObjId = null;
        if (!blank) {
          const candidate = await Candidate.findOne({ _id: candidateId, electionId: voter.electionId }).session(session);
          if (!candidate) throw new Error("INVALID_CANDIDATE");
          candidateObjId = candidate._id;
        }

        // BE-03: tracker ID is generated independently here (not derived from
        // a chain hash) because the chain hash itself isn't computed until
        // this vote is later flushed out of staging — see lib/ballotFlush.js.
        trackerId = generateTrackerId();

        await BallotStaging.create(
          [
            {
              electionId: voter.electionId,
              candidateId: candidateObjId,
              blank: !!blank,
              weight: voter.weight,
              trackerId,
            },
          ],
          { session }
        );
      },
      { maxCommitTimeMS: 5000, wtimeoutMS: 5000 }
    );

    // FE-07: this is the one and only place the tracker ID is ever returned.
    res.status(201).json({ trackerId });
  } catch (err) {
    const known = ["INVALID_TOKEN", "ELECTION_NOT_ACTIVE", "INVALID_CANDIDATE"];
    // BE-19: sanitized generic error to the client regardless of which branch failed.
    res.status(400).json({ error: known.includes(err.message) ? "Unable to record vote" : "Unable to record vote" });
  } finally {
    session.endSession();
  }
}
