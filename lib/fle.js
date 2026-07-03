import crypto from "crypto";

// BE-14 in spirit: encrypts voters.email before it reaches MongoDB, so a raw
// DB dump never contains a plaintext email. (True CSFLE via
// mongodb-client-encryption + a real KMS needs native bindings and
// infrastructure outside this app's scope — this is the pragmatic
// application-layer equivalent for the same threat model.)
//
// IV is derived deterministically from key+plaintext (HMAC), so the same
// email always encrypts to the same ciphertext — required so we can still
// query voters by email (e.g. de-duplication on CSV upload) without decrypting
// every row.
if (!process.env.FIELD_ENCRYPTION_KEY) {
  if (process.env.NODE_ENV === "production") {
    // Every voter email in the DB is only as safe as this key — unlike
    // pdfSign.js (where a dev-mode key just needs replacing before launch),
    // an unset key here means production PII was encrypted with a string
    // that ships in this file. That's not a warning-and-continue situation.
    throw new Error("FIELD_ENCRYPTION_KEY is not set. Refusing to start in production without it — see .env.local.example.");
  }
  console.warn("WARNING: FIELD_ENCRYPTION_KEY is not set. Using an insecure dev-only key — do not use this outside local development.");
}
const KEY = crypto.createHash("sha256").update(process.env.FIELD_ENCRYPTION_KEY || "dev-only-insecure-key").digest();

export function encryptEmail(plain) {
  const email = plain.trim().toLowerCase();
  const iv = crypto.createHmac("sha256", KEY).update(email).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(email, "utf8"), cipher.final()]);
  return Buffer.concat([iv, enc, cipher.getAuthTag()]).toString("base64"); // iv | ciphertext | tag
}

export function decryptEmail(blob) {
  const buf = Buffer.from(blob, "base64");
  const [iv, enc, tag] = [buf.subarray(0, 12), buf.subarray(12, -16), buf.subarray(-16)];
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
