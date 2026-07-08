import mongoose from "mongoose";

const CandidateSchema = new mongoose.Schema(
  {
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true, index: true },
    name: { type: String, required: true },
    // Lowercased/trimmed copy of `name`, used only for duplicate detection —
    // never displayed. Unique per election so two concurrent requests can't
    // both create "Ola Nordmann" / "ola nordmann" as separate candidates.
    nameNormalized: { type: String, required: true },
  },
  { timestamps: true }
);

CandidateSchema.index({ electionId: 1, nameNormalized: 1 }, { unique: true });

export default mongoose.models.Candidate || mongoose.model("Candidate", CandidateSchema);
