import mongoose from "mongoose";

// BE-03: transient holding area. A vote lands here atomically together with
// the voter's token being consumed (so we never risk a "voted but not
// recorded" state) — but this collection is never exposed via any API route
// and never read for tallying. A periodic job (lib/ballotFlush.js) moves
// rows out of here into the real Ballot chain in shuffled, batched order, so
// no observer — internal or external — can match a Voter-collection write
// to a Ballot-chain write by timestamp.
const BallotStagingSchema = new mongoose.Schema(
  {
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true, index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", default: null },
    blank: { type: Boolean, default: false },
    weight: { type: Number, required: true },
    trackerId: { type: String, required: true, unique: true }, // assigned here, survives the flush unchanged
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false, strict: "throw" }
);

export default mongoose.models.BallotStaging || mongoose.model("BallotStaging", BallotStagingSchema);
