import connectDB from "@/lib/db";
import Election from "@/models/Election";
import { getPublicKeyPem } from "@/lib/pdfSign";

// OP-08/BE-13: fully public, no auth. Anyone holding the PDF can hash it
// themselves, compare against `hash`, then verify `signature` over that hash
// using `publicKeyPem` (RSA-PSS/SHA-256) — no trust in this server required
// beyond the correctness of this published public key.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  await connectDB();
  const { electionId } = req.query;

  const election = await Election.findById(electionId).select(
    "status protocolPdfHash protocolSignature protocolSignedAt"
  );
  if (!election || election.status !== "CLOSED" || !election.protocolSignature)
    return res.status(404).json({ error: "No signed protocol available for this election" });

  res.json({
    publicKeyPem: getPublicKeyPem(),
    hash: election.protocolPdfHash,
    signature: election.protocolSignature,
    signedAt: election.protocolSignedAt,
    algorithm: "RSA-PSS with SHA-256 over the raw PDF bytes",
  });
}
