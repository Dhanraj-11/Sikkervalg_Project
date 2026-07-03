import crypto from "crypto";

// BE-11 / BE-23: the private key must live in a key vault (AWS KMS, GCP KMS,
// HashiCorp Vault, etc.) in production, never generated at runtime and never
// committed to source or env files alongside the app. This module reads from
// env if present and only falls back to generating an ephemeral dev keypair
// so the app runs out of the box locally.
//
//   PROTOCOL_SIGNING_PRIVATE_KEY_PEM  — PKCS#8 PEM, RSA 2048+
//   PROTOCOL_SIGNING_PUBLIC_KEY_PEM   — matching public key PEM
//
// If those aren't set, a keypair is generated once per process and cached on
// `global`, so it stays stable across hot reloads in dev but is NOT stable
// across deploys/restarts — do not rely on this fallback for anything real.
function loadOrGenerateKeys() {
  if (process.env.PROTOCOL_SIGNING_PRIVATE_KEY_PEM && process.env.PROTOCOL_SIGNING_PUBLIC_KEY_PEM) {
    return {
      privateKey: process.env.PROTOCOL_SIGNING_PRIVATE_KEY_PEM,
      publicKey: process.env.PROTOCOL_SIGNING_PUBLIC_KEY_PEM,
      dev: false,
    };
  }
  if (process.env.NODE_ENV === "production") {
    // Signing election protocols with a key that's regenerated on every
    // restart/deploy silently invalidates every previously-issued signature
    // and gives a false sense of integrity guarantees. Fail closed here,
    // same as fle.js (FIELD_ENCRYPTION_KEY) and email.js (no provider) —
    // this should never pass silently in production.
    throw new Error(
      "PROTOCOL_SIGNING_PRIVATE_KEY_PEM / PROTOCOL_SIGNING_PUBLIC_KEY_PEM are not set. Refusing to start in production without them — see .env.local.example."
    );
  }
  if (global._protocolKeys) return global._protocolKeys;

  console.warn("WARNING: PROTOCOL_SIGNING_*_PEM is not set. Using an ephemeral dev-only keypair — do not use this outside local development.");
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  global._protocolKeys = { privateKey, publicKey, dev: true };
  return global._protocolKeys;
}

export function signBuffer(buffer) {
  const { privateKey, dev } = loadOrGenerateKeys();
  const signature = crypto.sign("sha256", buffer, {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  });
  return { signature: signature.toString("base64"), dev };
}

export function verifyBuffer(buffer, signatureBase64) {
  const { publicKey } = loadOrGenerateKeys();
  return crypto.verify(
    "sha256",
    buffer,
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
    Buffer.from(signatureBase64, "base64")
  );
}

export function getPublicKeyPem() {
  return loadOrGenerateKeys().publicKey;
}

export function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}
