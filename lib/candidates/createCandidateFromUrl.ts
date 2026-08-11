import { Candidate } from "./types";
import { createCandidate } from "./createCandidate";
import { detectPlatform } from "./platforms/detectPlatform";
import { getAdapter } from "./platforms/registry";
import { ExtractOptions, ImportErrorType } from "./platforms/types";

export interface CreateCandidateFromUrlResult {
  candidate: Candidate;
  /** false means "extraction was incomplete", never "this failed and you
   *  have nothing" — `candidate` is always usable either way. */
  ok: boolean;
  reason?: string;
  errorType?: ImportErrorType;
}

/**
 * The orchestrator for the whole flow:
 *
 *   URL -> detectPlatform() -> platform adapter -> Candidate -> session
 *
 * This is the only function product code (Session/Vote UI) should call to
 * turn a pasted link into a Candidate. It never throws for "couldn't fully
 * extract details" — that's represented as `ok: false` with a `reason`,
 * exactly like a `PlatformAdapter.extract()` result. The caller decides
 * whether to add the candidate to the session as-is, or prompt the user to
 * fill in the missing title/details first.
 */
export async function createCandidateFromUrl(
  url: string,
  options?: ExtractOptions
): Promise<CreateCandidateFromUrlResult> {
  const platform = detectPlatform(url);

  if (platform === "unknown") {
    // No adapter recognizes this URL (includes Instagram links today,
    // since that adapter isn't implemented yet). Modeled as data: still
    // produces a valid Candidate with title/sourcePlatform/sourceUrl.
    // errorType is "unsupported_platform" for a well-formed URL we just
    // don't support, or "invalid_url" if the string wasn't a URL at all --
    // both are our app's limitation, not the external site's fault.
    let looksLikeUrl = true;
    try {
      new URL(url);
    } catch {
      looksLikeUrl = false;
    }
    return {
      ok: false,
      errorType: looksLikeUrl ? "unsupported_platform" : "invalid_url",
      reason: looksLikeUrl
        ? "아직 지원하지 않는 플랫폼 URL입니다."
        : "이 링크는 저희 앱이 읽을 수 있는 형식이 아니에요.",
      candidate: createCandidate({
        title: url,
        sourcePlatform: "manual",
        sourceUrl: url,
        createdBy: options?.createdBy,
      }),
    };
  }

  const adapter = getAdapter(url);
  if (!adapter) {
    // Defensive fallback; detectPlatform and getAdapter should never
    // disagree, but if they do, degrade the same way as "unknown".
    return {
      ok: false,
      reason: "어댑터를 찾지 못했습니다.",
      candidate: createCandidate({
        title: url,
        sourcePlatform: "manual",
        sourceUrl: url,
        createdBy: options?.createdBy,
      }),
    };
  }

  const result = await adapter.extract(url, options);
  return {
    ok: result.ok,
    reason: result.reason,
    errorType: result.errorType,
    candidate: result.candidate,
  };
}
