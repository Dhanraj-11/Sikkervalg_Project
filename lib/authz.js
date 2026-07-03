import Election from "@/models/Election";
import Organization from "@/models/Organization";

// Every route that takes an electionId in the body must call this before
// touching the election. Being logged in only proves *who* you are — this
// proves you're allowed to touch *this* election. Returns null (never
// throws) so callers can respond with a uniform 403/404 instead of leaking
// which case failed.
export async function loadOwnedElection(electionId, userId) {
  if (!electionId) return null;
  const election = await Election.findById(electionId);
  if (!election) return null;
  const org = await Organization.findOne({ _id: election.organizationId, ownerId: userId });
  if (!org) return null;
  return { election, org };
}
