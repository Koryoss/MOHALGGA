import { Candidate } from "../types";
import { CandidateSession } from "./types";

/**
 * Adds a candidate to a session immutably (returns a new session object;
 * does not mutate the input). De-dupes by `sourceUrl` when it's a real,
 * non-empty URL — synthetic seed/manual URLs (e.g. `internal://seed/...`)
 * are still deduped per-candidate since each seed title gets its own
 * synthetic URL, so two different seed candidates never collide.
 */
export function addCandidateToSession<T extends CandidateSession>(
  session: T,
  candidate: Candidate
): T {
  const isDuplicate = session.candidates.some((c) => c.sourceUrl === candidate.sourceUrl);
  if (isDuplicate) return session;
  return { ...session, candidates: [...session.candidates, candidate] };
}
