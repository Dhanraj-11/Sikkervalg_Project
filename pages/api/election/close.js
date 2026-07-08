import connectDB from "@/lib/db";
import Candidate from "@/models/Candidate";
import Ballot from "@/models/Ballot";
import Voter from "@/models/Voter";
import { requireAuth } from "@/lib/auth";
import { loadOwnedElection } from "@/lib/authz";
import { flushPendingBallots } from "@/lib/ballotFlush";
import { rollHash } from "@/lib/crypto";

// BE-12: once CLOSED, no route in this app ever exposes live/partial totals —
// this is the single place a tally is computed, and it's computed exactly once.
export default requireAuth(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  await connectDB();
  const owned = await loadOwnedElection(req.body.electionId, req.user.id);
  if (!owned) return res.status(404).json({ error: "Election not found" });
  const { election } = owned;
  const electionId = election._id;
  if (election.status === "CLOSED") return res.status(400).json({ error: "Election already closed" });

  // BE-03: sweep anything still sitting in staging — a vote cast seconds
  // before close must still end up in the tally, just shuffled in like any
  // other flush.
  await flushPendingBallots(electionId);

  const ballots = await Ballot.find({ electionId }).sort({ _id: 1 }).lean();
  const candidates = await Candidate.find({ electionId }).lean();

  // BE-04: weighted tally per candidate + blank.
  const totals = new Map(candidates.map((c) => [String(c._id), { name: c.name, weight: 0, count: 0 }]));
  let blank = { weight: 0, count: 0 };

  for (const b of ballots) {
    if (b.blank) {
      blank.weight += b.weight;
      blank.count += 1;
    } else {
      const key = String(b.candidateId);
      const t = totals.get(key);
      if (t) {
        t.weight += b.weight;
        t.count += 1;
      }
    }
  }

  // BE-05: if a tally bucket contains exactly one 0.5-weight ballot, it's
  // trivially de-anonymizable (whoever holds that 0.5-weight voter record
  // knows exactly who cast it). Round it up and flag it rather than publish
  // a bucket of size one at fractional weight.
  const deAnonRisk = [];
  function guard(bucketName, bucket) {
    if (bucket.count === 1 && bucket.weight === 0.5) {
      bucket.weight = 1.0;
      deAnonRisk.push(bucketName);
    }
  }
  guard("blank", blank);
  for (const [key, t] of totals) guard(t.name, t);

  const results = [...totals.values(), { name: "Blank stemme", weight: blank.weight, count: blank.count }];
  const ledgerHead = ballots.length ? ballots[ballots.length - 1].hash : null;

  // BE-25: prove the roll wasn't touched while ACTIVE. This doesn't block
  // close — a mismatch is evidence for the audit trail, not a reason to
  // strand a live election — but it's surfaced in the tally so it can never
  // be silently missed.
  const currentVoters = await Voter.find({ electionId }).select("_id weight").lean();
  const rollIntact = !election.rollHash || rollHash(currentVoters) === election.rollHash;

  election.status = "CLOSED";
  election.closedAt = new Date();
  election.tally = { results, totalBallots: ballots.length, deAnonRiskAdjusted: deAnonRisk, rollIntact };
  election.ledgerHead = ledgerHead;
  await election.save();

  res.json({ tally: election.tally, ledgerHead });
});
