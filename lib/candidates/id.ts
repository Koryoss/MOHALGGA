/** Generates a reasonably unique candidate id without pulling in a UUID
 *  dependency. Uses crypto.randomUUID() when available (browser/Node 19+),
 *  falls back to a timestamp + random suffix otherwise. */
export function generateCandidateId(prefix = "cand"): string {
  const hasRandomUUID =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
  const unique = hasRandomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}
