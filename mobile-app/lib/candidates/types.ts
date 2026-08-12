/**
 * Canonical Candidate shape shared by every candidate source: platform
 * adapters (Naver Map, Catchtable, ...), seed/cold-start data, and manual
 * user entries.
 *
 * Session state and Vote UI must depend ONLY on this interface — never on
 * platform-specific fields or adapter internals. This is what keeps
 * per-platform logic from leaking into product code.
 */

/** Platforms a candidate can originate from. Add a new value here (and a
 *  matching adapter) to support a new source — nothing else needs to know. */
export type SourcePlatform = "naver-map" | "catchtable" | "seed" | "manual";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Candidate {
  // --- Required ---
  id: string;
  title: string;
  sourcePlatform: SourcePlatform;
  sourceUrl: string;

  // --- Optional ---
  address?: string;
  category?: string;
  imageUrl?: string;
  coordinates?: Coordinates;
  createdBy?: string;
  /** ISO 8601 timestamp. */
  createdAt?: string;
}

/**
 * Input to `createCandidate()`. Only `title`, `sourcePlatform`, and
 * `sourceUrl` are mandatory — every other field, including `id`, is filled
 * in automatically if omitted. This is what guarantees a Candidate can
 * always be built from just those three fields.
 */
export type CandidateInput = Pick<Candidate, "title" | "sourcePlatform" | "sourceUrl"> &
  Partial<Omit<Candidate, "title" | "sourcePlatform" | "sourceUrl" | "id">> & {
    id?: string;
  };
