import { createCandidate } from "../../createCandidate";
import { extractMetaContent } from "../utils/htmlMeta";
import { ExtractOptions, ExtractionResult, PlatformAdapter } from "../types";

const HOSTS = ["map.naver.com", "naver.me"];

/** Best-effort title guess straight from the URL — used both as the
 *  no-fetcher fallback and as a backfill when og:title is missing. */
function titleFromUrl(url: URL): string | undefined {
  // e.g. https://map.naver.com/p/entry/place/12345678?query=상호명
  const query = url.searchParams.get("query") ?? url.searchParams.get("c");
  if (query) {
    const first = decodeURIComponent(query).split(",")[0]?.trim();
    if (first) return first;
  }

  // e.g. https://map.naver.com/p/search/스시코우지
  const segments = url.pathname.split("/").filter(Boolean);
  const searchIdx = segments.indexOf("search");
  const nextSegment = searchIdx >= 0 ? segments[searchIdx + 1] : undefined;
  if (nextSegment) {
    return decodeURIComponent(nextSegment);
  }

  return undefined;
}

function fallbackCandidate(rawUrl: string, title: string | undefined, createdBy?: string) {
  return createCandidate({
    title: title ?? "네이버 지도 장소 (제목 미확인)",
    sourcePlatform: "naver-map",
    sourceUrl: rawUrl,
    createdBy,
  });
}

export const naverMapAdapter: PlatformAdapter = {
  platform: "naver-map",

  matches(url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      return HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    } catch {
      return false;
    }
  },

  async extract(rawUrl, options?: ExtractOptions): Promise<ExtractionResult> {
    const url = new URL(rawUrl);
    const urlTitle = titleFromUrl(url);

    if (!options?.fetchHtml) {
      // No network access configured (typical for a pure client-side
      // build blocked by CORS). Modeled as a normal, non-error outcome.
      return {
        ok: false,
        errorType: "extraction_incomplete",
        reason: "no-fetcher: URL 파라미터만으로 제목을 추정했습니다.",
        candidate: fallbackCandidate(rawUrl, urlTitle, options?.createdBy),
      };
    }

    try {
      const html = await options.fetchHtml(rawUrl);
      const title = extractMetaContent(html, "og:title") ?? urlTitle;
      const imageUrl = extractMetaContent(html, "og:image");
      const address = extractMetaContent(html, "og:description");

      if (!title) {
        return {
          ok: false,
          errorType: "extraction_incomplete",
          reason: "og:title을 찾지 못했습니다.",
          candidate: createCandidate({
            title: "네이버 지도 장소 (제목 미확인)",
            sourcePlatform: "naver-map",
            sourceUrl: rawUrl,
            imageUrl,
            createdBy: options.createdBy,
          }),
        };
      }

      return {
        ok: true,
        candidate: createCandidate({
          title,
          sourcePlatform: "naver-map",
          sourceUrl: rawUrl,
          imageUrl,
          address,
          createdBy: options.createdBy,
        }),
      };
    } catch (err) {
      // Network / parse failure — still modeled as data, not thrown.
      return {
        ok: false,
        errorType: "fetch_failed",
        reason: err instanceof Error ? err.message : "알 수 없는 추출 오류",
        candidate: fallbackCandidate(rawUrl, urlTitle, options.createdBy),
      };
    }
  },
};
