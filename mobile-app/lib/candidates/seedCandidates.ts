import { Candidate } from "./types";
import { createCandidate } from "./createCandidate";

/**
 * Cold-start seed data, ported 1:1 from the HTML prototype's `POOLS` table
 * (index_pencil_swipe_candidates_v5.html, mode x situation -> string[]).
 *
 * These are placeholder recommendations, not real venues, so they don't
 * have a real link — they still carry a synthetic `internal://seed/...`
 * sourceUrl because sourceUrl is a required Candidate field, and every
 * candidate source (adapter, seed, manual) must satisfy the same contract.
 */

export type MatchMode = "solo" | "duo" | "trio" | "group";
export type Situation = "eat" | "play" | "chill" | "any";

const SEED_POOLS: Record<MatchMode, Record<Situation, string[]>> = {
  solo: {
    eat: ["라멘", "제육볶음", "초밥", "브런치", "떡볶이"],
    play: ["영화", "산책", "서점", "전시", "코인노래방"],
    chill: ["카페", "공원 산책", "책 읽기", "드라이브", "찜질방"],
    any: ["산책", "카페", "영화", "서점", "전시"],
  },
  duo: {
    eat: ["라멘", "제육볶음", "초밥", "파스타", "마라탕"],
    play: ["볼링", "전시", "보드게임 카페", "영화", "방탈출"],
    chill: ["카페", "산책", "드라이브", "공원", "한강 피크닉"],
    any: ["라멘", "카페", "전시", "볼링", "영화"],
  },
  trio: {
    eat: ["삼겹살", "초밥", "마라탕", "피자", "닭갈비"],
    play: ["볼링", "보드게임 카페", "방탈출", "코인노래방", "당구"],
    chill: ["대형 카페", "한강", "공원", "만화카페", "드라이브"],
    any: ["초밥", "볼링", "보드게임 카페", "카페", "방탈출"],
  },
  group: {
    eat: ["삼겹살", "치킨", "피자", "곱창", "닭갈비"],
    play: ["방탈출", "볼링", "보드게임 카페", "노래방", "스크린야구"],
    chill: ["대형 카페", "한강 피크닉", "공원", "루프탑", "드라이브"],
    any: ["삼겹살", "치킨", "방탈출", "볼링", "보드게임 카페"],
  },
};

function slugify(title: string): string {
  return encodeURIComponent(title.trim());
}

/**
 * Builds the Candidate[] list for a given mode/situation, in the exact same
 * shape every other candidate source (Naver Map, Catchtable, manual entry)
 * produces. This replaces raw string arrays as the seed data's public
 * shape — Session/Vote UI never sees a bare string, only Candidate.
 */
export function getSeedCandidates(mode: MatchMode, situation: Situation): Candidate[] {
  const titles = SEED_POOLS[mode]?.[situation] ?? SEED_POOLS[mode].any;
  return titles.map((title) =>
    createCandidate({
      title,
      sourcePlatform: "seed",
      sourceUrl: `internal://seed/${mode}/${situation}/${slugify(title)}`,
      category: situation,
    })
  );
}
