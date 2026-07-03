import mongoose from "mongoose";

// IMPORTANT (BE-01 / BE-21): this schema intentionally has NO field referencing
// a voter or user. That is the entire anonymity guarantee — a ballot row must
// be structurally incapable of being joined back to whoever cast it.
//
// IMPORTANT (BE-09): treat this collection as insert-only. No update/delete
// route for Ballot is ever exposed. In production also enforce this at the
// DB layer (Mongo JSON schema validator with `updates: false`, or a DB role
// restricted to insert + find).
const BallotSchema = new mongoose.Schema(
  {
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true, index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", default: null },
    blank: { type: Boolean, default: false }, // BE-10: blank vote is a first-class valid row
    weight: { type: Number, required: true },
    trackerId: { type: String, required: true, unique: true }, // ephemeral receipt shown once (FE-07)
    prevHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    castAt: { type: Date, default: Date.now },
  },
  { timestamps: false, strict: "throw" }
);

BallotSchema.pre(["updateOne", "findOneAndUpdate", "updateMany"], function (next) {
  next(new Error("Ballots collection is insert-only. Updates are not permitted."));
});
BallotSchema.pre(["deleteOne", "findOneAndDelete", "deleteMany"], function (next) {
  next(new Error("Ballots collection is insert-only. Deletes are not permitted."));
});

export default mongoose.models.Ballot || mongoose.model("Ballot", BallotSchema);
