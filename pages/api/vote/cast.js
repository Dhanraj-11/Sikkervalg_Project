import mongoose from "mongoose";
import connectDB from "@/lib/db";
import Voter from "@/models/Voter";
import Election from "@/models/Election";
import Candidate from "@/models/Candidate";
import BallotStaging from "@/models/BallotStaging";
import { hashToken, generateTrackerId } from "@/lib/crypto";
import { enforceRateLimit, clientIp } from "@/lib/rateLimit";
import { z } from "zod";

const CastVoteSchema = z.object({
  token: z.string().length(64, "Invalid token format"),
  candidateId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid candidate ID").nullable().optional(),
  blank: z.boolean().optional(),
  website: z.string().max(0, "Honeypot filled").optional(),
}).refine((data) => data.blank || data.candidateId, {
  message: "Must either vote blank or select a candidate",
});

// This is the heart of BE-01/BE-06/BE-21: token consumption (identity side)
// and ballot creation (choice side) happen inside one MongoDB transaction,
// but write to two collections that share no linking field. If anything
// fails, the whole transaction rolls back — a voter can never end up
// "consumed" without a ballot existing, or vice versa.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (await enforceRateLimit(req, res, "vote-cast", clientIp(req), { max: 30, windowMs: 10 * 60 * 1000 })) return;

  const result = CastVoteSchema.safeParse(req.body);
  if (!result.success) {
    if (result.error.issues.some((issue) => issue.message === "Honeypot filled")) {
      console.warn("[honeypot] blocked vote submission with filled trap field");
    }
    return res.status(400).json({ error: "Unable to record vote" });
  }

  const { token, candidateId, blank } = result.data;

  await connectDB();
  const session = await mongoose.startSession();
  try {
    let trackerId;

    await session.withTransaction(
      async () => {
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

    res.status(201).json({ trackerId });
  } catch (err) {
    res.status(400).json({ error: "Unable to record vote" });
  } finally {
    session.endSession();
  }
}
