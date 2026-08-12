import { Candidate, SourcePlatform } from "../types";

/**
 * Optional hook for fetching a URL's HTML for richer metadata extraction
 * (og:title, og:image, ...). Injected rather than hard-coded to `fetch` so:
 *   - adapters stay unit-testable with a mock,
 *   - a browser client (blocked by CORS on most platform sites) can supply
 *     a server-side proxy implementation instead.
 */
export type HtmlFetcher = (url: string) => Promise<string>;

export interface ExtractOptions {
  fetchHtml?: HtmlFetcher;
  createdBy?: string;
}

/**
 * Distinguishes *why* ok is false so the UI can phrase it honestly:
 *  - "invalid_url" / "unsupported_platform": our app's limitation (bad
 *    input or a site we don't support yet) — never the external site's fault.
 *  - "extraction_incomplete": a supported platform, but pattern/metadata
 *    extraction didn't yield a usable title.
 *  - "fetch_failed": the external site/network was the problem (timeout,
 *    blocked, non-2xx, redirect rejected, ...). Only reachable once a real
 *    HtmlFetcher is wired in — see SERVER_FETCH_SECURITY.md.
 */
export type ImportErrorType =
  | "invalid_url"
  | "unsupported_platform"
  | "extraction_incomplete"
  | "fetch_failed";

/**
 * Extraction result. "Couldn't get full details" is a normal, expected
 * outcome (`ok: false` + `reason`) — adapters must never throw for it.
 * `candidate` is always populated with at least the required fields, so a
 * failed extraction still yields something the session can accept.
 */
export interface ExtractionResult {
  ok: boolean;
  candidate: Candidate;
  reason?: string;
  errorType?: ImportErrorType;
}

export interface PlatformAdapter {
  platform: SourcePlatform;
  /** Cheap, synchronous URL sniff. No network calls. */
  matches(url: string): boolean;
  /** Best-effort metadata extraction. Must never throw. */
  extract(url: string, options?: ExtractOptions): Promise<ExtractionResult>;
}
