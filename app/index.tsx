import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { createCandidateFromUrl, type ImportErrorType } from "@/lib/candidates";

type Mode = "solo" | "duo" | "trio" | "group";
type Situation = "eat" | "play" | "chill" | "any";
type Vote = -2 | 0 | 1;
type Screen = "mode" | "setup" | "match";
type Candidate = {
  id: string;
  title: string;
  source: "starter" | "memory" | "url" | "manual";
  sourcePlatform?: string;
  sourceUrl?: string;
};
type Memory = Record<string, { uses: number; items: Record<string, { sum: number; count: number; decisions: number }> }>;

const MODES: { id: Mode; short: string; label: string }[] = [
  { id: "solo", short: "혼자", label: "혼자" },
  { id: "duo", short: "둘이", label: "연인/친구 1명" },
  { id: "trio", short: "셋이", label: "셋이" },
  { id: "group", short: "더 많이", label: "더 많이" },
];
const SITUATIONS: { id: Situation; label: string }[] = [
  { id: "eat", label: "먹기" }, { id: "play", label: "놀기" },
  { id: "chill", label: "쉬기" }, { id: "any", label: "아무거나" },
];
const POOLS: Record<Mode, Record<Situation, string[]>> = {
  solo: { eat: ["라멘", "제육볶음", "초밥", "브런치", "떡볶이"], play: ["영화", "산책", "서점", "전시", "코인노래방"], chill: ["카페", "공원 산책", "책 읽기", "드라이브", "찜질방"], any: ["산책", "카페", "영화", "서점", "전시"] },
  duo: { eat: ["라멘", "제육볶음", "초밥", "파스타", "마라탕"], play: ["볼링", "전시", "보드게임 카페", "영화", "방탈출"], chill: ["카페", "산책", "드라이브", "공원", "한강 피크닉"], any: ["라멘", "카페", "전시", "볼링", "영화"] },
  trio: { eat: ["삼겹살", "초밥", "마라탕", "피자", "닭갈비"], play: ["볼링", "보드게임 카페", "방탈출", "코인노래방", "당구"], chill: ["대형 카페", "한강", "공원", "만화카페", "드라이브"], any: ["초밥", "볼링", "보드게임 카페", "카페", "방탈출"] },
  group: { eat: ["삼겹살", "치킨", "피자", "곱창", "닭갈비"], play: ["방탈출", "볼링", "보드게임 카페", "노래방", "스크린야구"], chill: ["대형 카페", "한강 피크닉", "공원", "루프탑", "드라이브"], any: ["삼겹살", "치킨", "방탈출", "볼링", "보드게임 카페"] },
};
const MEMORY_KEY = "whatshallwe-memory";
const DECISIONS_KEY = "whatshallwe-decisions";
const ink = "#292824";

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function HomeButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="처음으로" hitSlop={10} style={styles.homeButton}><View style={styles.homeRoof}/><View style={styles.homeWall}><View style={styles.homeDoor}/></View></Pressable>;
}

function InviteButton() {
  return <Pressable onPress={() => Alert.alert("친구 초대", "Expo Go 버전에서는 기기 안에서 먼저 후보를 골라볼 수 있어요.")} accessibilityRole="button" accessibilityLabel="친구 초대" style={styles.inviteButton}><Text style={styles.inviteLabel}>친구 초대</Text><View style={styles.inviteSketch}><View style={styles.inviteSketchBody}/><View style={styles.inviteSketchTop}/><View style={styles.inviteSketchBottom}/></View></Pressable>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("mode");
  const [mode, setMode] = useState<Mode>("solo");
  const [situation, setSituation] = useState<Situation>("any");
  const [partner, setPartner] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote | undefined>>({});
  const [memory, setMemory] = useState<Memory>({});
  const [showResult, setShowResult] = useState(false);
  const [decided, setDecided] = useState(false);
  const [learnIndex, setLearnIndex] = useState<number | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorType, setImportErrorType] = useState<ImportErrorType | undefined>(undefined);
  const [fallback, setFallback] = useState<{ url: string; title: string } | null>(null);
  const cardX = useRef(new Animated.Value(0)).current;
  const learnX = useRef(new Animated.Value(0)).current;

  useEffect(() => { AsyncStorage.getItem(MEMORY_KEY).then(value => { if (value) setMemory(JSON.parse(value)); }).catch(() => undefined); }, []);
  const relation = `${mode}::${partner.trim().toLowerCase() || "self"}`;
  const participantNames = useMemo(() => partner.split(/[,，]/).map(name => name.trim()).filter(Boolean), [partner]);
  const currentIndex = candidates.findIndex(c => votes[c.id] === undefined);
  const answered = candidates.filter(c => votes[c.id] !== undefined).length;
  const allAnswered = candidates.length > 0 && answered === candidates.length;
  const learning = useMemo(() => POOLS[mode][situation].filter(x => !candidates.some(c => c.title === x)).slice(0, 5), [mode, situation, candidates]);

  const saveMemory = (next: Memory) => { setMemory(next); AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(next)).catch(() => undefined); };
  const makeCandidates = (nextSituation: Situation, selectedMode = mode, selectedPartner = partner) => {
    const selectedRelation = `${selectedMode}::${selectedPartner.trim().toLowerCase() || "self"}`;
    const history = memory[selectedRelation]?.items ?? {};
    const pool = [...POOLS[selectedMode][nextSituation]].sort((a, b) => ((history[b]?.sum ?? 0) + (history[b]?.decisions ?? 0) * 2) - ((history[a]?.sum ?? 0) + (history[a]?.decisions ?? 0) * 2));
    const picked = pool.slice(0, 3).map((title, i) => ({ id: `${i}-${uid()}`, title, source: history[title] ? "memory" as const : "starter" as const }));
    setMode(selectedMode); setPartner(selectedPartner); setSituation(nextSituation); setCandidates(picked); setVotes({}); setShowResult(false); setDecided(false); setLearnIndex(null); setScreen("match");
  };
  const vote = (kind: Vote) => {
    const current = candidates[currentIndex]; if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotes(old => ({ ...old, [current.id]: kind })); cardX.setValue(0);
  };
  const candidatePan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 3,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => cardX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (g.dx > 60 || g.dx < -60) {
        const direction = g.dx > 0 ? 1 : -1;
        Animated.timing(cardX, { toValue: direction * 500, duration: 160, useNativeDriver: true }).start(() => vote(direction === 1 ? 1 : -2));
      } else if (Math.abs(g.dx) < 8) vote(0);
      else Animated.spring(cardX, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(cardX, { toValue: 0, useNativeDriver: true }).start(),
  }), [currentIndex, candidates]);
  const score = (candidate: Candidate) => votes[candidate.id] ?? -999;
  const ordered = [...candidates].sort((a, b) => score(b) - score(a));
  const reason = (candidate: Candidate) => score(candidate) === 1 ? "오늘 끌리는 선택" : score(candidate) === 0 ? "무난한 선택" : "지금은 별로야";
  const persistVotes = () => {
    const next = { ...memory }; next[relation] ??= { uses: 0, items: {} }; next[relation].uses += 1;
    candidates.forEach(c => { const v = votes[c.id]; if (v === undefined) return; next[relation].items[c.title] ??= { sum: 0, count: 0, decisions: 0 }; next[relation].items[c.title].sum += v; next[relation].items[c.title].count += 1; });
    saveMemory(next);
  };
  const openResult = () => { persistVotes(); setShowResult(true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); };
  const decide = async () => {
    const top = ordered.find(c => score(c) > -2); if (!top) return;
    const next = { ...memory }; next[relation] ??= { uses: 0, items: {} }; next[relation].items[top.title] ??= { sum: 0, count: 0, decisions: 0 }; next[relation].items[top.title].decisions += 1; saveMemory(next);
    const previous = JSON.parse((await AsyncStorage.getItem(DECISIONS_KEY)) ?? "[]");
    AsyncStorage.setItem(
      DECISIONS_KEY,
      JSON.stringify([{ title: top.title, at: new Date().toISOString() }, ...previous].slice(0, 50)),
    ).catch(() => undefined);
    setDecided(true); setLearnIndex(0); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const remember = (value: number) => {
    if (learnIndex === null || !learning[learnIndex]) return;
    const next = { ...memory }; next[relation] ??= { uses: 0, items: {} }; const title = learning[learnIndex]; next[relation].items[title] ??= { sum: 0, count: 0, decisions: 0 }; next[relation].items[title].sum += value; next[relation].items[title].count += 1; saveMemory(next);
    learnX.setValue(0); setLearnIndex(i => i === null ? null : i + 1);
  };
  const learnPan = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4, onPanResponderMove: (_, g) => learnX.setValue(g.dx), onPanResponderRelease: (_, g) => { if (g.dy < -55) remember(2); else if (g.dx > 60) remember(1); else if (g.dx < -60) remember(-2); else Animated.spring(learnX, { toValue: 0, useNativeDriver: true }).start(); }, onPanResponderTerminate: () => Animated.spring(learnX, { toValue: 0, useNativeDriver: true }).start() }), [learnIndex, learning]);

  const addImportedCandidate = (title: string, source: Candidate["source"], sourcePlatform?: string, sourceUrl?: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (sourceUrl && candidates.some(c => c.sourceUrl === sourceUrl)) return;
    setCandidates(prev => [...prev, { id: uid(), title: trimmed, source, sourcePlatform, sourceUrl }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const submitImportUrl = async () => {
    const url = importUrl.trim();
    setImportError(null); setImportErrorType(undefined);
    if (!url) { setImportError("링크를 입력해줘."); return; }
    const result = await createCandidateFromUrl(url);
    if (result.ok) {
      addImportedCandidate(result.candidate.title, "url", result.candidate.sourcePlatform, result.candidate.sourceUrl);
      setImportUrl("");
    } else {
      setImportError(result.reason ?? "장소 정보를 정확히 가져오지 못했어요. 장소 이름만 적어주세요.");
      setImportErrorType(result.errorType);
      setFallback({ url, title: result.candidate.title });
    }
  };
  const confirmFallback = () => {
    if (!fallback) return;
    addImportedCandidate(fallback.title, "manual", "manual", fallback.url);
    setFallback(null); setImportUrl(""); setImportError(null); setImportErrorType(undefined);
  };
  const cancelFallback = () => { setFallback(null); setImportError(null); setImportErrorType(undefined); setImportUrl(""); };
  const removeCandidate = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setVotes(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  if (screen === "mode") return <SafeAreaView style={styles.page}><View style={[styles.modePage, { justifyContent: "center" }]}><View style={[styles.modeTitleArea, { paddingTop: 0 }]}><Text style={styles.title}>누구랑 뭐할까?</Text><View style={styles.titleUnderline}/></View><View style={[styles.modeControlArea, { marginTop: 40 }]}><View style={styles.modeGrid}>{MODES.map((item, index) => <Pressable key={item.id} onPress={() => { if (item.id === "solo") makeCandidates("any", "solo", ""); else { setMode(item.id); setScreen("setup"); } }} style={[styles.modeChoice, styles.modeGridChoice, mode === item.id && styles.modeChoiceActive, { transform: [{ rotate: `${index % 2 === 0 ? -2 : 2}deg` }] }]}><Text style={styles.modeChoiceDots}>{"·".repeat(index + 1)}</Text><Text style={styles.modeChoiceText}>{item.short}</Text></Pressable>)}</View></View></View></SafeAreaView>;

  if (screen === "setup") return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={[styles.setupPage, styles.setupPageTop]}><Text style={styles.setupTopTitle}>{mode === "group" ? "누구랑?" : `${MODES.find(item => item.id === mode)?.short} 뭐하지?`}</Text><View style={[styles.paper, styles.setupPaperFixed]}>{mode !== "solo" && <><Text style={styles.inputLabel}>{mode === "group" ? "참여자" : "누구랑?"}</Text><TextInput value={partner} onChangeText={setPartner} placeholder={mode === "group" ? "예: 민수, 지수, 소연" : mode === "trio" ? "예: 민수, 지수" : "예: 민수와"} placeholderTextColor="#a29e94" style={styles.input} />{mode === "group" && participantNames.length > 0 && <View style={styles.participantList}>{participantNames.map(name => <View key={name} style={styles.participantChip}><Text style={styles.participantChipText}>{name}</Text></View>)}</View>}</>}<Pressable style={styles.candidateStartButton} onPress={() => makeCandidates("any")}><Text style={styles.candidateStartText}>후보 넘겨보기 →</Text></Pressable></View></ScrollView><View style={styles.homeBottom}><HomeButton onPress={() => setScreen("mode")} /></View></SafeAreaView>;

  const current = candidates[currentIndex];
return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.matchPage}><View style={[styles.header, { justifyContent: "flex-end" }]}><InviteButton /></View><Text style={styles.matchTitle}>{mode === "solo" ? "혼자" : partner || MODES.find(m => m.id === mode)?.short} 뭐 하지?</Text>{memory[relation]?.uses ? <Text style={styles.memoryNote}>이전 반응을 이번 후보에 살짝 반영했어.</Text> : null}<View style={styles.candidatesHead}><Text style={styles.candidatesTitle}>오늘 후보</Text><Text style={styles.progress}>{answered}/{candidates.length}</Text></View><View style={styles.importRow}><TextInput value={importUrl} onChangeText={setImportUrl} placeholder="네이버맵/캐치테이블 링크 붙여넣기" placeholderTextColor="#a29e94" autoCapitalize="none" autoCorrect={false} style={styles.importInput} /><Pressable style={styles.importButton} onPress={submitImportUrl}><Text style={styles.importButtonText}>추가</Text></Pressable></View>{importError && !fallback && <Text style={styles.importErrorText}>{importError}</Text>}{fallback && <View style={styles.fallbackBox}><Text style={styles.importErrorText}>{importError}</Text><TextInput value={fallback.title} onChangeText={title => setFallback(f => f ? { ...f, title } : f)} placeholder="장소 이름만 적어줘" placeholderTextColor="#a29e94" style={styles.fallbackInput} /><View style={styles.fallbackButtons}><Pressable style={styles.fallbackConfirm} onPress={confirmFallback}><Text style={styles.importButtonText}>이 이름으로 추가</Text></Pressable><Pressable style={styles.fallbackCancel} onPress={cancelFallback}><Text style={styles.fallbackCancelText}>취소</Text></Pressable></View></View>}{candidates.length > 0 && <View style={styles.chipRow}>{candidates.map(c => <View key={c.id} style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{c.title}</Text><Pressable onPress={() => removeCandidate(c.id)} hitSlop={8}><Text style={styles.chipRemove}>×</Text></Pressable></View>)}</View>}{current ?<Animated.View {...candidatePan.panHandlers} style={[styles.card, { transform: [{ translateX: cardX }, { rotate: cardX.interpolate({ inputRange: [-200, 0, 200], outputRange: ["-8deg", "0deg", "8deg"] }) }] }]}><Text style={styles.cardNumber}>후보 {currentIndex + 1}</Text><Text style={styles.cardTitle}>{current.title}</Text>{current.source === "memory" && <Text style={styles.memoryBadge}>우리 기억</Text>}<View style={styles.hint}><Text>← 별로</Text><Text>탭 · 괜찮아</Text><Text>좋아 →</Text></View></Animated.View> : <View style={[styles.card, styles.completeCard]}><Text style={styles.cardTitle}>다 골랐어</Text></View>}{allAnswered && !showResult && <Pressable style={styles.resultButton} onPress={openResult}><Text style={styles.resultButtonText}>결과 보기</Text></Pressable>}{showResult && <View style={styles.resultBox}><Text style={styles.resultEyebrow}>오늘은 이 순서 어때?</Text>{ordered.map((c, i) => <View key={c.id} style={styles.resultRow}><Text style={[styles.rank, i === 0 && styles.topRank]}>{i + 1}</Text><View><Text style={styles.resultTitle}>{c.title}</Text><Text style={styles.resultReason}>{reason(c)}</Text></View></View>)}<Pressable style={[styles.resultButton, decided && styles.disabled]} disabled={decided} onPress={decide}><Text style={styles.resultButtonText}>{decided ? "결정했어 ✓" : `1위 ${ordered[0]?.title}로 결정하기 ✓`}</Text></Pressable>{decided && <Text style={styles.decision}>이걸로 가자! 다음엔 이 선택도 기억할게.</Text>}</View>}{learnIndex !== null && <View style={styles.learnBox}><Text style={styles.learnTitle}>다음엔 더 잘 골라줄게</Text><Text style={styles.learnText}>원하면 가볍게 넘겨줘.</Text>{learnIndex < learning.length ? <Animated.View {...learnPan.panHandlers} style={[styles.learnCard, { transform: [{ translateX: learnX }] }]}><Text style={styles.learnProgress}>{learnIndex + 1} / {learning.length}</Text><Text style={styles.learnName}>{learning[learnIndex]}</Text><Text style={styles.learnHint}>← 별로 · ↑ 진짜 좋아 · 좋아 →</Text></Animated.View> : <Text style={styles.decision}>기억했어. 다음 선택에 반영할게 ✨</Text>}{learnIndex < learning.length && <View style={styles.voteButtons}><Pressable onPress={() => remember(-2)} style={styles.voteButton}><Text>별로</Text></Pressable><Pressable onPress={() => remember(2)} style={styles.voteButton}><Text>진짜 좋아</Text></Pressable><Pressable onPress={() => remember(1)} style={styles.voteButton}><Text>좋아</Text></Pressable></View>}</View>}</ScrollView><View style={styles.homeBottom}><HomeButton onPress={() => setScreen("mode")} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f4f0e6" }, modePage: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 32 }, modeTitleArea: { alignItems: "center", paddingTop: "12%" }, title: { fontFamily: "Gaegu_700Bold", fontSize: 48, color: ink, transform: [{ rotate: "-1deg" }] }, titleLine: { color: ink, fontSize: 16, marginTop: -14, opacity: 0.72 }, modeControlArea: { width: "100%", alignItems: "center" }, modeRail: { height: 96, width: "100%", position: "relative", justifyContent: "center" }, modeLine: { height: 2, backgroundColor: "#5d5a53", opacity: 0.7, width: "100%", transform: [{ rotate: "-0.3deg" }] }, modeHandle: { position: "absolute", left: 0, width: 96, height: 96, borderRadius: 50, borderWidth: 1.8, borderColor: ink, backgroundColor: "#faf8f1", alignItems: "center", justifyContent: "center", shadowColor: ink, shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.08, shadowRadius: 0, elevation: 2 }, modeHandleDots: { fontSize: 19, lineHeight: 18, color: "#767269", fontFamily: "Gaegu_700Bold" }, modeHandleText: { fontFamily: "Gaegu_700Bold", color: ink, fontSize: 22, marginTop: 2 }, modeDescription: { marginTop: 29, color: "#767269", fontSize: 17, textAlign: "center" }, modeFooter: { color: "#9a958a", fontSize: 17, textAlign: "center", paddingBottom: "7%" }, setupPage: { flex: 1, justifyContent: "center", padding: 20 }, back: { color: "#767269", fontSize: 18 }, paper: { marginTop: 22, padding: 24, borderWidth: 1.5, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1" }, sectionTitle: { textAlign: "center", color: ink, fontFamily: "Gaegu_700Bold", fontSize: 33 }, inputLabel: { marginTop: 28, color: "#767269", fontFamily: "Gaegu_700Bold", fontSize: 18 }, input: { fontSize: 21, color: ink, borderBottomWidth: 1.5, borderBottomColor: "#68645c", paddingVertical: 8 }, situationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 28 }, situation: { width: "47%", minHeight: 60, borderWidth: 1.2, borderColor: "#77736b", borderRadius: 20, justifyContent: "center", alignItems: "center" }, situationSelected: { borderWidth: 2.5, borderColor: ink }, situationText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 23 }, matchPage: { padding: 20, paddingBottom: 60 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, invite: { borderWidth: 1, borderColor: "#77736b", paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 }, matchTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 39, marginTop: 28 }, memoryNote: { marginTop: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#8d877a", borderRadius: 12, color: "#767269", padding: 11, fontSize: 16 }, candidatesHead: { marginTop: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, candidatesTitle: { fontFamily: "Gaegu_700Bold", color: ink, fontSize: 23 }, progress: { color: "#767269", borderWidth: 1, borderColor: "#9e998d", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 2, fontFamily: "Gaegu_700Bold", fontSize: 16 }, card: { height: 320, borderWidth: 1.5, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1", marginTop: 16, alignItems: "center", justifyContent: "center", padding: 20 }, cardNumber: { color: "#767269", fontSize: 20 }, cardTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 40, marginTop: 7, textAlign: "center" }, memoryBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderStyle: "dashed", borderColor: "#77736b", borderRadius: 12, color: "#625e56", fontSize: 16 }, hint: { position: "absolute", bottom: 19, left: 17, right: 17, flexDirection: "row", justifyContent: "space-between", color: "#767269" }, completeCard: { height: 170 }, completeText: { color: "#767269", fontSize: 20, marginTop: 6 }, resultButton: { backgroundColor: ink, borderRadius: 13, padding: 14, alignItems: "center", marginTop: 16 }, resultButtonText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 21 }, resultBox: { borderWidth: 1.5, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1", padding: 18, marginTop: 18 }, resultEyebrow: { fontFamily: "Gaegu_700Bold", fontSize: 29, color: ink, marginBottom: 8 }, resultRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#d8d2c5", paddingVertical: 11, gap: 12 }, rank: { color: ink, borderWidth: 1.2, borderColor: ink, borderRadius: 20, overflow: "hidden", width: 34, height: 34, textAlign: "center", paddingTop: 5, fontFamily: "Gaegu_700Bold", fontSize: 19 }, topRank: { backgroundColor: ink, color: "#faf8f1" }, resultTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 23 }, resultReason: { color: "#767269", fontSize: 15 }, disabled: { opacity: 0.5 }, decision: { color: ink, fontFamily: "Gaegu_700Bold", textAlign: "center", marginTop: 14, fontSize: 18 }, learnBox: { marginTop: 20, borderWidth: 1.3, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1", padding: 18 }, learnTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 25 }, learnText: { color: "#767269", fontSize: 17 }, learnCard: { borderWidth: 1, borderColor: "#aaa397", borderRadius: 20, alignItems: "center", padding: 22, marginTop: 15, backgroundColor: "#f7f4eb" }, learnProgress: { color: "#767269", fontFamily: "Gaegu_700Bold" }, learnName: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 32, marginTop: 8 }, learnHint: { color: "#767269", marginTop: 18, fontSize: 14 }, voteButtons: { flexDirection: "row", gap: 8, marginTop: 10 }, voteButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#77736b", borderRadius: 12 },
  titleUnderline: { width: "82%", marginTop: 1, height: 8, borderBottomWidth: 2, borderBottomColor: "#4c4943", borderRadius: 50, transform: [{ rotate: "-1deg" }], opacity: 0.72 },
  modeCarousel: { alignItems: "center", gap: 14, paddingVertical: 12 },
  carouselEdge: { width: 10 },
  modeChoice: { width: 142, height: 174, borderWidth: 1.5, borderColor: "#706c63", borderRadius: 72, backgroundColor: "#faf8f1", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  modeChoiceActive: { borderWidth: 2.5, borderColor: ink, backgroundColor: "#f9f6ed", shadowColor: ink, shadowOpacity: 0.12, shadowOffset: { width: 2, height: 3 }, shadowRadius: 0, elevation: 2 },
  modeChoiceDots: { color: "#767269", fontFamily: "Gaegu_700Bold", fontSize: 22, lineHeight: 20 },
  modeChoiceText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 29, marginTop: 4 },
  modeChoiceLabel: { color: "#767269", fontSize: 15, textAlign: "center", marginTop: 5 },
  setupTopTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 39, marginTop: 26 },
  setupPageTop: { justifyContent: "flex-start", paddingTop: 12 },
  setupPaperFixed: { minHeight: 300, justifyContent: "space-between" },
  situationList: { flexDirection: "column", flexWrap: "nowrap", gap: 9 },
  situationListItem: { width: "100%", minHeight: 76 },
  customCandidateLabel: { marginTop: 20, color: "#767269", fontFamily: "Gaegu_700Bold", fontSize: 18 },
  candidateStartButton: { marginTop: 26, minHeight: 72, borderRadius: 15, backgroundColor: ink, alignItems: "center", justifyContent: "center" },
  candidateStartText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 24 },
  modeGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 14, paddingHorizontal: 8 },
  modeGridChoice: { width: "47.5%", height: undefined, aspectRatio: 1, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  participantList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  participantChip: { borderWidth: 1, borderColor: "#77736b", borderRadius: 18, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: "#f4f0e6" },
  participantChipText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 18 },
  homeButton: { width: 34, height: 34, alignItems: "center", justifyContent: "flex-end", paddingBottom: 3 },
  homeBottom: { position: "absolute", left: 0, right: 0, bottom: 18, alignItems: "center" },
  homeRoof: { position: "absolute", top: 4, width: 20, height: 20, borderTopWidth: 2, borderLeftWidth: 2, borderColor: ink, transform: [{ rotate: "45deg" }] },
  homeWall: { width: 18, height: 15, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2, borderColor: ink, alignItems: "center", justifyContent: "flex-end" },
  homeDoor: { width: 5, height: 8, borderWidth: 1.5, borderBottomWidth: 0, borderColor: ink },
  inviteButton: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#77736b", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  inviteLabel: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 },
  inviteSketch: { width: 19, height: 18, position: "relative" },
  inviteSketchBody: { position: "absolute", left: 8, top: 2, width: 2, height: 17, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "44deg" }] },
  inviteSketchTop: { position: "absolute", right: 1, top: 1, width: 10, height: 2, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "-5deg" }] },
  inviteSketchBottom: { position: "absolute", right: 1, top: 2, width: 2, height: 10, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "-5deg" }] },
  importRow: { flexDirection: "row", gap: 8, marginTop: 12, alignItems: "center" },
  importInput: { flex: 1, fontSize: 16, color: ink, borderWidth: 1, borderColor: "#9e998d", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#faf8f1" },
  importButton: { borderRadius: 12, backgroundColor: ink, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  importButtonText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 16 },
  importErrorText: { marginTop: 8, color: "#8a5a3d", fontSize: 14 },
  fallbackBox: { marginTop: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#8d877a", borderRadius: 12, padding: 12, backgroundColor: "#faf8f1" },
  fallbackInput: { marginTop: 8, fontSize: 16, color: ink, borderWidth: 1, borderColor: "#9e998d", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  fallbackButtons: { flexDirection: "row", gap: 8, marginTop: 10 },
  fallbackConfirm: { flex: 1, borderRadius: 12, backgroundColor: ink, paddingVertical: 10, alignItems: "center" },
  fallbackCancel: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#77736b", paddingVertical: 10, alignItems: "center" },
  fallbackCancelText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#77736b", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#f4f0e6", maxWidth: 180 },
  chipText: { color: ink, fontSize: 14 },
  chipRemove: { color: "#767269", fontSize: 16, fontFamily: "Gaegu_700Bold" },
});
