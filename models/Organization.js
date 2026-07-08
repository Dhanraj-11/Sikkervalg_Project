import mongoose from "mongoose";

const OrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    orgNumber: { type: String, required: true },
    verified: { type: Boolean, default: false },
    // unique: one HR user can own exactly one organization. Enforced here
    // (not just in the API route) so it holds even under concurrent
    // requests — a unique index is race-proof, an application-level check
    // alone is not.
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.Organization || mongoose.model("Organization", OrgSchema);
