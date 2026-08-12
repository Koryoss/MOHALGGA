import { createCandidate } from "../../createCandidate";
import { extractMetaContent } from "../utils/htmlMeta";
import { ExtractOptions, ExtractionResult, PlatformAdapter } from "../types";

const HOSTS = ["catchtable.co.kr", "app.catchtable.co.kr", "catchtable.com"];

/** Best-effort title guess from the shop slug in the URL path,
 *  e.g. https://app.catchtable.co.kr/ct/shop/mira-korean-dining -> "mira korean dining". */
function titleFromUrl(url: URL): string | undefined {
  const segments = url.pathname.split("/").filter(Boolean);
  const shopIdx = segments.indexOf("shop");
  const slug = shopIdx >= 0 ? segments[shopIdx + 1] : segments[segments.length - 1];
  if (!slug) return undefined;
  return decodeURIComponent(slug).replace(/[-_]+/g, " ").trim() || undefined;
}

function fallbackCandidate(rawUrl: string, title: string | undefined, createdBy?: string) {
  return createCandidate({
    title: title ?? "캐치테이블 매장 (제목 미확인)",
    sourcePlatform: "catchtable",
    sourceUrl: rawUrl,
    createdBy,
  });
}

export const catchtableAdapter: PlatformAdapter = {
  platform: "catchtable",

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
      return {
        ok: false,
        errorType: "extraction_incomplete",
        reason: "no-fetcher: URL 경로만으로 제목을 추정했습니다.",
        candidate: fallbackCandidate(rawUrl, urlTitle, options?.createdBy),
      };
    }

    try {
      const html = await options.fetchHtml(rawUrl);
      const title = extractMetaContent(html, "og:title") ?? urlTitle;
      const imageUrl = extractMetaContent(html, "og:image");
      const address = extractMetaContent(html, "og:description");
      const category = extractMetaContent(html, "og:type");

      if (!title) {
        return {
          ok: false,
          errorType: "extraction_incomplete",
          reason: "og:title을 찾지 못했습니다.",
          candidate: createCandidate({
            title: "캐치테이블 매장 (제목 미확인)",
            sourcePlatform: "catchtable",
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
          sourcePlatform: "catchtable",
          sourceUrl: rawUrl,
          imageUrl,
          address,
          category,
          createdBy: options.createdBy,
        }),
      };
    } catch (err) {
      return {
        ok: false,
        errorType: "fetch_failed",
        reason: err instanceof Error ? err.message : "알 수 없는 추출 오류",
        candidate: fallbackCandidate(rawUrl, urlTitle, options.createdBy),
      };
    }
  },
};
