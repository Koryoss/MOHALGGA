import { Candidate, CandidateInput } from "./types";
import { generateCandidateId } from "./id";

/**
 * The single place that constructs a Candidate. Every candidate source
 * (adapters, seed data, manual entry) goes through this so the "required
 * vs optional" contract is enforced in exactly one spot.
 *
 * Only title / sourcePlatform / sourceUrl are mandatory — everything else,
 * including id and createdAt, is filled in automatically when omitted.
 */
export function createCandidate(input: CandidateInput): Candidate {
  const title = input.title?.trim();
  if (!title) {
    throw new Error("Candidate.title is required and cannot be empty.");
  }
  if (!input.sourcePlatform) {
    throw new Error("Candidate.sourcePlatform is required.");
  }
  if (!input.sourceUrl) {
    throw new Error("Candidate.sourceUrl is required.");
  }

  return {
    id: input.id ?? generateCandidateId(),
    title,
    sourcePlatform: input.sourcePlatform,
    sourceUrl: input.sourceUrl,
    address: input.address,
    category: input.category,
    imageUrl: input.imageUrl,
    coordinates: input.coordinates,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}
