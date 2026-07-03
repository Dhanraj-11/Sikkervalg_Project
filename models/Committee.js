import mongoose from "mongoose";

const CommitteeSchema = new mongoose.Schema(
  {
    electionId: { type: mongoose.Schema.Types.ObjectId, ref: "Election", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    email: { type: String, required: true },
    approved: { type: Boolean, default: false },
    approvedAt: Date,
    // Hash of a 256-bit random invite token (see lib/crypto.js generateToken/
    // hashToken — same pattern as voter ballot tokens). The raw token is only
    // ever emailed, never stored. Using this instead of the Mongo _id as the
    // join secret matters because _id is not high-entropy (it embeds a
    // timestamp) and — more importantly — was previously readable by the HR
    // admin's own dashboard (election/summary.js), which would have let HR
    // claim other committee members' seats and single-handedly activate an
    // election meant to require three independent approvals.
    tokenHash: { type: String, index: true },
  },
  { timestamps: true }
);

// Don't let the same email get invited to the same election twice — that
// would produce two Committee rows racing to claim one join link.
CommitteeSchema.index({ electionId: 1, email: 1 }, { unique: true });

export default mongoose.models.Committee || mongoose.model("Committee", CommitteeSchema);
