import mongoose from "mongoose";

const VoterSchema = new mongoose.Schema(
  {
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true, index: true },
    // BE-14: stores encryptEmail() output, never a plaintext address.
    // Encrypt/decrypt explicitly at the API boundary (lib/fle.js) rather than
    // via a hidden ODM hook — keeps every read/write of PII auditable at a glance.
    email: { type: String, required: true },
    name: String,
    weight: { type: Number, default: 1 },
    hasVoted: { type: Boolean, default: false },
    tokenHash: { type: String, index: true }, // looked up on every /api/vote/cast call
    tokenExpiresAt: Date, // magic link is single-use AND time-boxed to the election window
    linkSentAt: Date, // set once a magic link has been generated/dispatched for this voter (resume-state UI relies on this)
  },
  { timestamps: true }
);

// One roll entry per person per election. Safe to enforce on the encrypted
// value because lib/fle.js derives the IV deterministically from the
// plaintext — the same email always produces the same ciphertext, so this
// index still catches duplicates without ever storing plaintext.
VoterSchema.index({ electionId: 1, email: 1 }, { unique: true });

export default mongoose.models.Voter || mongoose.model("Voter", VoterSchema);
