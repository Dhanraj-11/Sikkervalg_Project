import mongoose from "mongoose";

const OrgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    orgNumber: { type: String, required: true },
    verified: { type: Boolean, default: false },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.Organization || mongoose.model("Organization", OrgSchema);
