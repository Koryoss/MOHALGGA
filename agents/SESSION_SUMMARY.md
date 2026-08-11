# 세션 정리 - "뭐할까?" 외부 링크 후보 확장 작업

이 문서는 이번 작업 세션에서 결정되고 구현된 내용을 한 곳에 모은 기록이다. 각 항목의 담당 Agent는 `agents/` 폴더의 개별 역할 파일 참조.

## 1. Candidate 데이터 구조 + Adapter 패턴 (Software Engineer Agent)

`lib/candidates/`에 플랫폼 독립적인 Candidate 데이터 레이어를 구현했다.

- `Candidate` 인터페이스: 필수(`id`, `title`, `sourcePlatform`, `sourceUrl`) + 선택(`address`, `category`, `imageUrl`, `coordinates`, `createdBy`, `createdAt`).
- `PlatformAdapter` 인터페이스 + Naver Map / Catchtable 어댑터. Instagram은 공식 API 부재로 미구현.
- 흐름: `URL → detectPlatform() → adapter.extract() → Candidate → session`.
- 추출 실패는 예외가 아니라 `ExtractionResult{ok:false, reason, candidate}`로 정상 모델링 — 실패해도 최소 요건(title/sourcePlatform/sourceUrl)을 갖춘 Candidate가 항상 나온다.
- 기존 Seed 후보도 동일한 Candidate 인터페이스로 리팩터링(`getSeedCandidates()`).
- `npx tsc --noEmit` + `npx tsx demo.ts`로 검증 완료.

## 2. 제품 범위 분석 및 P0 승인 (CEO Agent + PM Agent)

현재 구조(단일 HTML 프로토타입, 서버 없음, 정적 Seed 후보만 사용)를 분석하고 다음을 확정했다.

- **보존**: 연필 손그림 디자인, 관계→상황→후보 흐름, 스와이프 제스처(좌=별로/우=좋아/탭=괜찮아), 가입 없는 게스트 참여, Decision Completed 구조, Relationship Memory.
- **변경**: 후보 데이터 소스를 Seed 전용에서 Seed + URL 유래 Candidate로 확장.
- **P0 확정(승인됨)**: 서버/프록시 없이 URL 패턴 추정만으로 Naver Map·Catchtable 링크 → Candidate 생성. 후보 개수 2~5개 유연화는 기존 로직 회귀 위험 때문에 이번 단계에서 제외, 다음 단계로 연기.
- **기술 리스크로 식별**: CORS로 인한 실제 og:meta 추출 불가(서버 없이는 URL 패턴 추정 수준), 네이버 단축 URL 리다이렉트 추적 불가, 초대 링크 payload 길이 증가 가능성.

## 3. URL Import 구현 (AI Researcher Agent + CS/Trust Agent)

`index_pencil_swipe_candidates_v5.html`에 실제로 연결.

- 처리 순서: URL 형식 검증 → 플랫폼 판별 → URL 패턴 기반 제목 추정 → Candidate 생성 → 실패 시 fallback.
- **fallback**: 실패 원인과 무관하게 "장소 정보를 정확히 가져오지 못했어요. 장소 이름만 적어주세요." 한 화면으로 수렴. 제목 하나만 입력하면 Candidate 생성 완료, 결정 흐름은 끊기지 않음.
- **에러 구분**: `invalid_url` / `unsupported_platform` / `extraction_incomplete`(우리 앱의 한계) vs `fetch_failed`(외부 사이트/네트워크 문제, 서버 fetch 도입 시에만 도달 가능하도록 타입으로 미리 분리).
- `sourceUrl`은 모든 실패 경로에서도 보존되고, 초대 링크(payload)에도 그대로 실려 게스트에게도 전달됨.
- 후보 제목 인라인 수정, ✕ 삭제 기능 추가. 후보가 0개여도 크래시 없이 안내 문구로 처리.
- 기존 스와이프·투표·결과·기억·초대 로직은 무손상.
- **서버 fetch 보안 경계**: 이번 단계에서 서버는 구현하지 않았다. 대신 향후 실제 og:meta 추출용 서버 fetcher를 만들 때 지켜야 할 SSRF/redirect chain/private IP 차단 기준을 `lib/candidates/platforms/SERVER_FETCH_SECURITY.md`에 설계 문서로만 정리해둠(코드 없음).

## 4. 시장 조사 문서 업데이트 (Researcher Agent)

`뭐할까_통합_시장조사_보고서_2026-08.docx`에 "2-1. 경쟁 대안 조사표 - 4단계 보완판" 섹션 추가.

- 직접(TasteMate/Cobble/Hayya) / 간접(넛지/Beli·Mapstr) / 대체재(네이버지도·인스타·캐치테이블/카카오톡) / 아무것도 안 함(Do-Nothing) 4단계로 재구성.
- "고객이 계속 쓰는 이유" 열은 공개 재방문 데이터가 아니라 가설임을 명시, 인터뷰 검증 전까지 근거로 쓰지 않는다고 표기.
- 기존 "관계별 기억" 경쟁축과 연결한 해석 추가: 네이버지도/인스타에서 찾는다 → 카톡에서 공유한다 → 뭐할까에서 함께 결정한다 → "이 사람들과 무엇을 골랐는지"가 남는다 → 이 마지막 단계가 실제 재사용(Same-pair Repeat)을 만드는지가 핵심 검증 포인트.
- 담당 Agent 명시: AI 리서처(조사) · AI 데이터분석가(가설 검증 표시) · AI PM(반영 판단).

## 5. 8개 역할 Agent 파일

`agents/` 폴더에 CEO, Researcher, Data Analyst, PM, Designer, Brand Manager, Marketer/Creator, CS 8개 역할별 판단 기준 파일을 만들고, CEO 파일에 8개 Agent를 포함한 회사 구조도를 추가함.

## 6. 사업성 지표, 수익모델, 시장충격 테스트, 투자 피칭 (각 담당 Agent)

- `BUSINESS_METRICS_OWNERSHIP.md`: TAM/SAM/SOM, ARPU/CAC/LTV, Conversion/Margin/Churn 담당 배분. 지금 단계는 Conversion(결정 완료)·Churn(관계 단위 재사용)만 확정.
- `REVENUE_MODEL.md`: 스폰서십 광고(1순위)·예약 제휴(2순위)·프리미엄 구독(보조)·B2B/API(장기) 제시안과 담당 배분. 가격·수수료는 전부 미검증 가정으로 명시.
- `MARKET_SHOCK_TEST.md`: 네이버지도·카카오가 그룹 결정 기능을 출시하는 시장충격 시나리오와 대응 전략(투표 앱 → 관계 기억 앱으로 포지셔닝 전환).
- `ceo.md`에 30초 투자 피칭 스크립트(problem-evidence-solution-money-differentiation 순, 확인된 데이터만 사용) 확정.

## 7. Expo 앱과의 관계 (2026.08)

`app/index.tsx`(이 저장소)에 웹 프로토타입의 핵심 루프(관계 선택 → 상황 선택 → 후보 스와이프 → 결과 → 결정 → 스와이프 러닝)가 이미 React Native/Expo Router로 포팅돼 있는 걸 확인. 다만 이번 세션에서 웹에 새로 넣은 URL import(`lib/candidates`)와 실제 게스트/초대 딥링크는 아직 여기 반영되지 않았다. `agents/*.md`와 `lib/candidates/*`를 이 저장소로 선택적 포팅함 - node_modules·`.git`은 건드리지 않았고, 안 쓰이는 서울 혼자놀기 지도 컴포넌트(SeoulMap 등)·미사용 서버/OAuth/DB 스캐폴딩은 그대로 둠(정리 대상으로만 표시, 삭제하지 않음).

## 다음 단계 후보 (아직 미승인, 각 담당 Agent가 제안만 해둔 상태)

- 이벤트 계측(`session_started` 등) 부착 — Data Analyst 담당, 아직 미구현.
- 후보 개수 2~5개 유연화 — PM이 다음 단계로 제안, CEO 승인 대기.
- 서버 fetch 도입(실제 og:meta 추출 품질 개선) — Researcher/Engineer가 보안 경계만 설계, CEO 승인 대기.
- `lib/candidates`의 URL import 로직을 `app/index.tsx`에 실제로 연결 — 아직 미착수.
- 안 쓰이는 서울 혼자놀기 컴포넌트·미사용 서버 스캐폴딩 정리 여부 — CEO 승인 대기.
