/**
 * Runnable sanity check for the module (not a formal test suite).
 *   npx tsx demo.ts
 */
import { createCandidate } from "./createCandidate";
import { getSeedCandidates } from "./seedCandidates";
import { detectPlatform } from "./platforms/detectPlatform";
import { createCandidateFromUrl } from "./createCandidateFromUrl";
import { addCandidateToSession } from "./session/addCandidateToSession";
import { updateCandidateTitle } from "./session/updateCandidateTitle";
import { removeCandidateFromSession } from "./session/removeCandidateFromSession";
import { CandidateSession } from "./session/types";

async function main() {
  console.log("--- 1. minimal Candidate (title/sourcePlatform/sourceUrl only) ---");
  const minimal = createCandidate({
    title: "직접 입력한 장소",
    sourcePlatform: "manual",
    sourceUrl: "manual://user-entry/1",
  });
  console.log(minimal);

  console.log("\n--- 2. seed candidates use the same Candidate shape ---");
  console.log(getSeedCandidates("duo", "eat"));

  console.log("\n--- 3. detectPlatform ---");
  console.log("naver map:", detectPlatform("https://map.naver.com/p/entry/place/12345?query=스시코우지"));
  console.log("catchtable:", detectPlatform("https://app.catchtable.co.kr/ct/shop/mira-korean-dining"));
  console.log("instagram (not implemented):", detectPlatform("https://www.instagram.com/p/abc123/"));
  console.log("malformed:", detectPlatform("not a url"));

  console.log("\n--- 4. createCandidateFromUrl, no fetcher (URL-only fallback) ---");
  const naverResult = await createCandidateFromUrl(
    "https://map.naver.com/p/entry/place/12345?query=스시코우지"
  );
  console.log(naverResult);

  console.log("\n--- 5. createCandidateFromUrl, with a mock fetcher (rich extraction) ---");
  const mockHtml = `
    <html><head>
      <meta property="og:title" content="스시코우지 강남점" />
      <meta property="og:image" content="https://example.com/photo.jpg" />
      <meta property="og:description" content="서울 강남구 테헤란로 1" />
    </head></html>
  `;
  const richResult = await createCandidateFromUrl(
    "https://map.naver.com/p/entry/place/12345?query=스시코우지",
    { fetchHtml: async () => mockHtml, createdBy: "yoojin" }
  );
  console.log(richResult);

  console.log("\n--- 6. extraction failure modeled as normal state (fetcher throws) ---");
  const failedResult = await createCandidateFromUrl("https://app.catchtable.co.kr/ct/shop/mira-korean-dining", {
    fetchHtml: async () => {
      throw new Error("network timeout");
    },
  });
  console.log(failedResult);

  console.log("\n--- 7. unsupported platform (Instagram) still yields a usable Candidate ---");
  const igResult = await createCandidateFromUrl("https://www.instagram.com/p/abc123/");
  console.log(igResult);

  console.log("\n--- 8. session integration, no platform-specific fields leak through ---");
  let session: CandidateSession = { sessionId: "s-1", candidates: [] };
  session = addCandidateToSession(session, minimal);
  session = addCandidateToSession(session, naverResult.candidate);
  session = addCandidateToSession(session, richResult.candidate);
  session = addCandidateToSession(session, richResult.candidate); // duplicate, should be ignored
  console.log(session.candidates.map((c) => ({ title: c.title, platform: c.sourcePlatform })));
  console.log("candidate count (dedup check):", session.candidates.length);

  console.log("\n--- 9. errorType taxonomy across failure modes ---");
  console.log("malformed string:", (await createCandidateFromUrl("not a url")).errorType);
  console.log("unsupported platform:", (await createCandidateFromUrl("https://www.instagram.com/p/abc123/")).errorType);
  console.log("extraction incomplete (no fetcher):", (await createCandidateFromUrl("https://map.naver.com/p/entry/place/12345")).errorType);
  console.log(
    "fetch failed (fetcher throws):",
    (
      await createCandidateFromUrl("https://map.naver.com/p/entry/place/12345?query=x", {
        fetchHtml: async () => {
          throw new Error("boom");
        },
      })
    ).errorType
  );

  console.log("\n--- 10. edit + delete on a session ---");
  session = updateCandidateTitle(session, minimal.id, "수정된 이름");
  console.log("after rename:", session.candidates.find((c) => c.id === minimal.id)?.title);
  session = removeCandidateFromSession(session, minimal.id);
  console.log("after delete, count:", session.candidates.length, "ids:", session.candidates.map((c) => c.id));
}

main();
