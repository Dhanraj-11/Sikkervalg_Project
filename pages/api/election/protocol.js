import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { buildValgprotokollPdf } from "@/lib/valgprotokoll";
import { signBuffer, sha256Hex } from "@/lib/pdfSign";

// BE-11: signs the PDF exactly once per election, on first request after
// close, then stores and replays those exact bytes forever after. This is
// what makes "signed" mean something — nobody, including this server, can
// regenerate a different PDF under the same signature.
export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const owned = await loadOwnedElection(req.body.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  const { election } = owned;
  const electionId = election._id;
  if (election.status !== "CLOSED")
    return res.status(400).json({ error: "Election must be closed before the protocol can be generated" });

  if (!election.protocolPdfBase64) {
    const candidates = await Candidate.find({ electionId }).lean();

    const pdfBuffer = await buildValgprotokollPdf({ org: owned.org, election, candidates });
    const hash = sha256Hex(pdfBuffer);
    const { signature, dev } = signBuffer(pdfBuffer);

    election.protocolPdfBase64 = pdfBuffer.toString("base64");
    election.protocolPdfHash = hash;
    election.protocolSignature = signature;
    election.protocolSignedAt = new Date();
    await election.save();

    if (dev) {
      console.warn(
        "WARNING: Valgprotokoll signed with an ephemeral dev-mode RSA key. " +
          "Set PROTOCOL_SIGNING_PRIVATE_KEY_PEM / PROTOCOL_SIGNING_PUBLIC_KEY_PEM " +
          "(ideally sourced from a real key vault) before this goes anywhere near production."
      );
    }
  }

  res.json({
    pdfBase64: election.protocolPdfBase64,
    hash: election.protocolPdfHash,
    signature: election.protocolSignature,
    signedAt: election.protocolSignedAt,
  });
});
