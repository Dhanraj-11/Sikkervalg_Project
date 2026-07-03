import mongoose from "mongoose";

const ElectionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true },
    type: String,
    startTime: Date,
    endTime: Date,
    status: { type: String, enum: ["DRAFT", "ACTIVE", "CLOSED"], default: "DRAFT" },
    closedAt: Date,
    rollHash: String, // BE-25: fingerprint of the voter roll at the instant it locked (DRAFT→ACTIVE)
    // BE-04/BE-05 results, computed once at close and frozen — never recomputed
    // live so BE-12 (no reads of running totals) has something to enforce.
    tally: mongoose.Schema.Types.Mixed,
    ledgerHead: String, // hash of the final ballot in the chain at close time
    // BE-11: set exactly once, the first time the protocol PDF is generated
    // for a CLOSED election. Never overwritten — regenerating the PDF later
    // reuses this stored signature rather than re-signing new bytes, so the
    // signed artifact can't silently drift from what was first published.
    protocolPdfHash: String,
    protocolSignature: String,
    protocolSignedAt: Date,
    protocolPdfBase64: String, // the exact signed bytes — regenerating would invalidate the signature
  },
  { timestamps: true }
);

export default mongoose.models.Election || mongoose.model("Election", ElectionSchema);
