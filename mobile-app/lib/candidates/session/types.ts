import { Candidate } from "../types";

/**
 * Minimal session shape needed for candidate ingestion. Real session state
 * (mode, situation, partner, votes, participantVotes, ...) can extend this
 * freely — this file intentionally knows nothing about voting or UI, only
 * that a session holds a Candidate[].
 */
export interface CandidateSession {
  sessionId: string;
  candidates: Candidate[];
}
