import BallotStaging from "@/models/BallotStaging";
import Ballot from "@/models/Ballot";
import { chainHash, GENESIS_HASH } from "@/lib/crypto";

// BE-03. Called two places: the periodic cron (pages/api/cron/flush-ballots.js)
// and once more, unconditionally, right before an election is closed and
// tallied (pages/api/election/close.js) — so a vote cast seconds before
// close can never be stranded in staging and silently excluded from the count.
//
// What this buys you: the collection anyone can actually query, export, or
// tally from (Ballot) never receives writes at the same instant a Voter row
// changes, and never receives them in the order they were cast. What it does
// NOT buy you: perfect protection against someone with live read access to
// this staging collection itself — no software fix can hide a write from an
// observer who watches literally everything in real time. The mitigation
// here matches what BE-03 actually asks for: break timestamp/order
// correlation on the record anyone would realistically use to deanonymize.
export async function flushPendingBallots(electionId) {
  const pending = await BallotStaging.find(electionId ? { electionId } : {}).lean();
  if (!pending.length) return { flushed: 0 };

  // Fisher-Yates: arrival order must not survive into chain order.
  for (let i = pending.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pending[i], pending[j]] = [pending[j], pending[i]];
  }

  const byElection = new Map();
  for (const p of pending) {
    const key = String(p.electionId);
    if (!byElection.has(key)) byElection.set(key, []);
    byElection.get(key).push(p);
  }

  let flushed = 0;
  for (const [electionIdKey, items] of byElection) {
    const last = await Ballot.findOne({ electionId: electionIdKey }).sort({ _id: -1 }).lean();
    let prevHash = last ? last.hash : GENESIS_HASH;

    const docs = items.map((p) => {
      const payload = {
        electionId: electionIdKey,
        candidateId: p.candidateId ? String(p.candidateId) : null,
        blank: !!p.blank,
        weight: p.weight,
        trackerId: p.trackerId,
      };
      const hash = chainHash(prevHash, payload);
      const doc = {
        electionId: p.electionId,
        candidateId: p.candidateId,
        blank: p.blank,
        weight: p.weight,
        trackerId: p.trackerId,
        prevHash,
        hash,
      };
      prevHash = hash;
      return doc;
    });

    await Ballot.insertMany(docs);
    await BallotStaging.deleteMany({ _id: { $in: items.map((p) => p._id) } });
    flushed += docs.length;
  }

  return { flushed };
}
