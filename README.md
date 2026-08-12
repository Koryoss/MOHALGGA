# honja-nolgi

Expo Go에서 바로 실행하는, 서울의 혼자 놀기 코스를 발견하는 가벼운 React Native + TypeScript MVP입니다. 로그인·서버·지도 타일·API 키 없이 모든 기본 화면과 데이터가 오프라인에서 동작합니다.

## 실행

```bash
pnpm install
pnpm expo start
```

표시된 QR 코드를 Expo Go로 스캔하거나, `pnpm android` / `pnpm ios`를 실행합니다. 웹 전용 명령 대신 Expo의 기본 Metro 서버를 사용합니다.

## 구성

- `app/index.tsx`: 인트로와 지도/상세 상태 전환
- `components/SeoulMap.tsx`: `react-native-svg`로 그리는 터치 가능한 25개 자치구 경계
- `components/DistrictNavigator.tsx`: 선택 구의 인접·근접 구 4개 탐색
- `components/CourseCard.tsx`, `data/courses.ts`: 오프라인 코스 8개
- `data/seoul-districts.json`: 번들에 포함된 단순화 경계

사용 패키지는 Expo, React Native, Expo Router(엔트리), `react-native-svg`뿐입니다. MVP 화면은 별도 내비게이션·상태 관리·네트워크 라이브러리를 사용하지 않습니다.

## 지도 데이터 출처와 라이선스

`data/seoul-districts.json`은 [southkorea/seoul-maps](https://github.com/southkorea/seoul-maps)의 `kostat/2013/json/seoul_municipalities_geo_simple.json`을 파일명만 변경해 포함한 것입니다. 이 데이터셋은 KOSTAT(통계청) 센서스용 행정구역경계를 바탕으로 하고, 원 저장소에서 MapShaper Visvalingam/weighted-area 방식으로 5% 단순화했습니다. 원 저장소의 라이선스는 Apache License 2.0입니다. 따라서 경계는 실제 공개 GIS 경계 기반이며 모바일 SVG 렌더링용으로만 단순화되어 있습니다.

## 다음 단계

코스별 사진·공유 기능은 서버 없이도 기기 공유 API로 추가할 수 있고, 코스 선택 UI·즐겨찾기(AsyncStorage)·최신 공식 경계 데이터 교체를 단계적으로 확장할 수 있습니다.
