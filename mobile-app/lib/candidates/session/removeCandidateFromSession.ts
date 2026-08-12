import { CandidateSession } from "./types";

/**
 * Removes a candidate from a session immutably. Deletion must always be
 * available — a bad import (wrong place, duplicate, garbled title) can't
 * become permanent clutter blocking the decision flow.
 */
export function removeCandidateFromSession<T extends CandidateSession>(
  session: T,
  candidateId: string
): T {
  return { ...session, candidates: session.candidates.filter((c) => c.id !== candidateId) };
}
