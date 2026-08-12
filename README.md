# 뭐할까

> **정본(canonical) 앱:** 이 저장소의 루트입니다. 설치·실행·검사·커밋·푸시는 모두 `~/Desktop/프로젝트/뭐할까`에서 수행합니다. `mobile-app/`은 병합 과정에서 들어온 비교·보관용 사본이며 실행 기준으로 사용하지 않습니다.

친구·연인·모임과의 "뭐 하지?" 결정을 가장 적은 행동으로 끝내는 의사결정 앱입니다. 인원 선택 → 상황 선택 → 후보 스와이프 → 결과 결정까지 이어지며, 초대받은 게스트는 회원가입 없이 바로 참여합니다(Guests Don't Sign Up). Expo Go에서 바로 실행되는 React Native + TypeScript 앱입니다.

**Light Memory × Group Taste × Fast Decision** — 취향 프로필을 쌓는 앱이 아니라, 매 결정의 가벼운 반응(별로/괜찮아/좋아)을 관계별로 기억해 다음 결정에 바로 써먹는 앱입니다. 자세한 포지셔닝은 `agents/ceo.md`의 "회사 소개" 참고.

## 실행

```bash
pnpm install
pnpm expo start
```

표시된 QR 코드를 Expo Go로 스캔하거나, `pnpm android` / `pnpm ios`를 실행합니다.

## 핵심 흐름

1. **인원 선택**: 혼자 / 둘이 / 셋이 / 더 많이
2. **상황 선택**: 먹기 / 놀기 / 쉬기 / 아무거나
3. **후보 스와이프**: 좌 별로 / 우 좋아 / 탭 괜찮아 — 2명 이상이면 참여자별로 순서대로 진행(패스 더 폰) 후 평균 점수로 결과 결정
4. **후보 추가**: 기본 제공 Seed 후보 외에 네이버지도·캐치테이블 등 링크를 붙여넣으면 URL 패턴 추정으로 후보가 생성됩니다. 추출에 실패하면 장소 이름을 직접 입력하는 화면으로 자연스럽게 넘어갑니다(`lib/candidates`).
5. **관계별 기억**: 결정 결과가 참여자 조합별로 저장되어 다음 추천에 반영됩니다.

## 구성

- `app/index.tsx`: 인원→상황→후보 스와이프→결과 전체 화면 로직
- `lib/candidates/`: URL(네이버지도/캐치테이블 등)에서 후보를 만드는 로직과 실패 시 fallback 처리
- `agents/`: CEO·Researcher·Data Analyst·PM·Designer·Brand Manager·Marketer/Creator·CS 8개 역할별 판단 기준 문서. 제품 방향·회사 소개는 `agents/ceo.md`, 진행 이력은 `agents/SESSION_SUMMARY.md` 참고.

## 현재 구현 범위

제품 아키텍처는 Home / Bucket / Match / Plan 4개 기능으로 설계되어 있지만, 지금 앱에는 **Match(후보 스와이프 → 결정)만** 구현되어 있습니다. 참여자별 투표는 단순 평균이며, 그룹 크기별 가중치(Duo veto/3인 선호 계산/Squad 가중치)는 아직 설계 문서 단계입니다. 상세는 `agents/pm.md`, `agents/data-analyst.md` 참고.

## 레거시 코드 안내

이전 컨셉이었던 "혼자 놀기(서울 코스 탐색)" MVP의 미사용 지도·코스 자산은 `archive/honja-nolgi/`로 옮겼습니다. 전체 실행 가능 스냅샷은 GitHub의 `archive/honja-nolgi-mvp` 브랜치에 보존되어 있으며, 현재 앱 빌드에는 포함되지 않습니다.

`mobile-app/`에도 앱 전체 사본이 남아 있습니다. 필요한 UI 차이를 루트 앱으로 선별 반영한 뒤 별도 단계에서 보관 위치를 정하거나 제거할 예정입니다. 그전까지 기능 수정은 루트 `app/`, `lib/`, `components/`, `data/`에만 적용합니다.

## 다음 단계

승인 대기 중인 항목은 `agents/SESSION_SUMMARY.md`의 "다음 단계 후보"에 정리되어 있습니다: 원격 초대(다른 기기로 참여), 이벤트 계측, 후보 개수 2~5개 유연화, 서버 fetch 도입, Home/Bucket/Plan 착수, Duo veto/Squad 가중치 구현 등.
