# 사업성 검증 핵심 지표 - 담당 Agent 배분

창업·사업성 검증에서 자주 쓰는 지표를 "시장 크기 → 고객 한 명의 경제성 → 사업 구조 건강도" 3단으로 정리하고, `agents/` 폴더에 정의된 8개 역할 중 누가 무엇을 1차로 책임지는지 배분한다. 각 지표 옆의 담당은 "이 숫자를 만들고 책임지는 사람"이고, 괄호 안은 그 숫자를 만드는 데 필요한 데이터를 공급하거나 최종 판단에 쓰는 협업자다.

## 1. TAM / SAM / SOM - 시장이 얼마나 큰가

- **TAM (Total Addressable Market)**: 이론적으로 가능한 전체 시장. 예: 대한민국 전체 영어교육 시장 10조 원.
- **SAM (Serviceable Available Market)**: 그중 내 서비스가 실제로 공략할 수 있는 시장. 예: 초등학생 대상 영어교육 시장 2조 원.
- **SOM (Serviceable Obtainable Market)**: 그중 우리가 현실적으로 가져올 수 있는 시장. 예: 수도권 초등 AI·영어교육 고객 중 50억 원 시장.

**담당: Researcher Agent** (CEO Agent 최종 검토)

시장 크기 추정은 Researcher의 기존 판단 기준("아직 검증되지 않은 가정을 구현으로 굳혀버렸는가?")이 그대로 적용되는 영역이다. TAM은 조사가 가능하지만, SAM·SOM으로 좁아질수록 근거 없는 낙관적 추정이 섞이기 쉽다. `뭐할까_통합_시장조사_보고서`에서 이미 "직접 시장 통계 확인불가 시 임의 TAM 추정 금지"를 원칙으로 명시한 것과 같은 기준을 SAM/SOM에도 적용한다. SOM은 결국 "이번 단계에 어디까지 공략할 것인가"라는 범위 승인 문제이기도 해서, Researcher가 근거를 만들면 CEO가 최종 숫자를 승인한다.

## 2. ARPU / CAC / LTV - 고객 한 명이 돈이 되는가

- **ARPU (Average Revenue Per User)**: 고객 1명당 평균 매출. 총 매출 ÷ 고객 수. 예: 100명이 월 30만 원씩 → ARPU 30만 원.
- **CAC (Customer Acquisition Cost)**: 고객 1명을 데려오는 데 쓰는 비용. 마케팅·영업비 ÷ 신규 고객 수. 예: 광고비 500만 원으로 20명 확보 → CAC 25만 원.
- **LTV (Lifetime Value)**: 고객 1명이 이용 기간 동안 만들어주는 총 가치. 월 ARPU × 평균 유지기간. 예: 월 30만 원 × 10개월 = LTV 300만 원.
- 투자자가 가장 많이 보는 건 **LTV와 CAC의 관계** (예: CAC 25만 원, LTV 300만 원이면 좋은 구조).

**담당: Data Analyst Agent** (Marketer/Creator Agent가 CAC 원가 데이터 공급, CEO Agent가 LTV:CAC 비율 최종 판단)

ARPU·LTV는 결제/구독 이벤트가 중복 없이 정확히 집계되어야 성립하는 숫자라 Data Analyst의 판단 기준("핵심 이벤트와 idempotency가 정확한가?")과 정확히 겹친다. CAC는 실제 마케팅 집행비를 아는 Marketer/Creator가 원가를 공급하고, Data Analyst가 신규 고객 수 데이터와 묶어 계산한다. 이 프로젝트는 아직 결제·구독 자체가 없는 단계이므로, 지금은 ARPU/CAC/LTV를 계산할 데이터가 없다는 것 자체가 Data Analyst의 1차 보고 내용이 된다.

## 3. Conversion / Margin / Churn - 사업 구조가 건강한가

- **Conversion Rate, 전환율**: 관심을 가진 사람이 실제 고객이 되는 비율. 구매 고객 ÷ 방문자 × 100. 예: 1,000명 방문 → 50명 결제 → 5%.
- **Margin, 마진율**: 매출에서 비용을 빼고 남는 비율. 예: 10만 원 상품, 원가 4만 원 → Margin 60%.
- **Churn, 이탈률**: 기존 고객이 그만두는 비율. 예: 회원 100명 중 이번 달 5명 해지 → Churn 5%. 구독형 서비스는 낮을수록 좋다.

이 셋은 성격이 달라 담당을 하나로 묶지 않는다.

**Conversion → PM Agent(제품 내부 퍼널) + Marketer/Creator Agent(유입 퍼널)**
제품 안에서는 URL → Candidate → Reaction → Decision 흐름 자체가 퍼널이다. 이미 사업계획서에 있는 Top-3 Accept Rate, Invite → Vote Rate가 사실상 이 프로젝트의 Conversion 지표다. 앱 밖 유입(광고·콘텐츠 → 첫 세션 시작)은 Marketer/Creator가 책임진다.

**Margin → CEO Agent**
8개 역할 중 재무를 전담하는 역할이 따로 없어서, 비용 구조와 수익성 최종 판단은 CEO가 흡수한다. Data Analyst가 원가·매출 데이터를 정리해 올리면 CEO가 마진 목표를 승인한다.

**Churn → CS Agent(원인 진단) + Data Analyst Agent(측정)**
이탈은 대부분 실패 경험(링크 실패, 잘못된 후보, 게스트 오류)에서 시작된다는 게 CS Agent의 기존 판단 기준이다. 이 프로젝트에서는 Churn 자체보다 먼저 Same-pair Repeat(같은 관계에서 다시 쓰는가)를 보고 있는데, 이건 사실상 Churn의 반대 지표다. Data Analyst가 측정을 설계하고, CS가 이탈 원인을 실제 실패 로그와 연결해 해석한다.

## 한 줄 요약 - 담당 배분표

| 구분 | 지표 | 1차 담당 | 협업 |
|---|---|---|---|
| 시장 크기 | TAM / SAM / SOM | Researcher | CEO(SOM 승인) |
| 고객 경제성 | ARPU / LTV | Data Analyst | Marketer/Creator(CAC 원가) |
| 고객 경제성 | CAC | Marketer/Creator | Data Analyst(계산) |
| 사업 구조 | Conversion | PM(제품 내부) / Marketer(유입) | Data Analyst(측정) |
| 사업 구조 | Margin | CEO | Data Analyst(원가 데이터) |
| 사업 구조 | Churn | CS(원인) | Data Analyst(측정) |

## 이 프로젝트 현재 상태에 대한 메모

지금 "뭐할까?"는 결제·구독이 없는 단계라 ARPU/CAC/LTV/Margin/Churn을 실제로 계산할 데이터가 없다. 사업계획서의 North Star(Decision Completed)와 보조 지표(Median Time to Decision, Top-3 Accept Rate, Invite → Vote Rate, Same-pair Repeat, Swipe Opt-in/Completion)가 먼저 갖춰야 할 선행 지표이고, 그 다음 단계에서 위 표의 지표들이 의미를 가진다. Researcher Agent 기준대로, 지금 이 숫자들을 임의로 채워 넣지 않는 것 자체가 이번 단계의 올바른 판단이다.
