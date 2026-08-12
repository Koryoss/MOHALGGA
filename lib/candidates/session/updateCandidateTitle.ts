import { CandidateSession } from "./types";

/**
 * Renames a candidate's title in place (immutably). Used both for
 * "user fixes a wrong/garbled auto-extracted name" and for completing the
 * fallback flow ("couldn't extract — type the name yourself").
 * No-ops (returns the same session reference) if the id isn't found or the
 * new title is blank, so callers don't need to pre-validate.
 */
export function updateCandidateTitle<T extends CandidateSession>(
  session: T,
  candidateId: string,
  newTitle: string
): T {
  const title = newTitle.trim();
  if (!title) return session;
  let changed = false;
  const candidates = session.candidates.map((c) => {
    if (c.id !== candidateId) return c;
    changed = true;
    return { ...c, title };
  });
  return changed ? { ...session, candidates } : session;
}
