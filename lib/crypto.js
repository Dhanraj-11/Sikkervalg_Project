import crypto from "crypto";

// Raw, single-use magic-link token. Only this raw value is ever emailed to a
// voter — it is never stored anywhere. Only its hash lives in the database.
export function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Each ballot's hash binds the previous ballot's hash with this ballot's own
// payload, forming an append-only chain (BE-02). Tampering with any past
// ballot breaks every hash after it, which is what makes the ledger auditable.
export function chainHash(prevHash, payload) {
  return crypto
    .createHash("sha256")
    .update(prevHash + JSON.stringify(payload))
    .digest("hex");
}

// Short, voter-facing receipt derived from the ballot hash (e.g. TRK-89A2-BC4D).
// It is purely for the voter to visually confirm inclusion — it carries no
// information linking back to their identity.
export function trackerIdFromHash(hash) {
  const seg = hash.toUpperCase();
  return `TRK-${seg.slice(0, 4)}-${seg.slice(4, 8)}`;
}

// The first ballot in each election's chain links to this fixed value instead
// of a real previous hash, so an empty chain still has a well-defined start.
export const GENESIS_HASH = "0".repeat(64);

// BE-25: fingerprints the voter roll (id + weight, sorted) at the instant it
// locks, so tally time can prove nobody quietly added/removed/reweighted a
// voter after the roll was supposed to be frozen.
export function rollHash(voters) {
  const sorted = voters.map((v) => `${v._id}:${v.weight}`).sort();
  return crypto.createHash("sha256").update(sorted.join("|")).digest("hex");
}
// BE-03: the receipt shown to the voter (FE-07) is now generated at cast
// time, independently of the chain hash — because the chain hash itself
// isn't computed until the ballot is later flushed out of staging in
// shuffled order. It carries no information linking back to the voter.
export function generateTrackerId() {
  const a = crypto.randomBytes(4).toString("hex").toUpperCase();
  const b = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TRK-${a}-${b}`;
}
