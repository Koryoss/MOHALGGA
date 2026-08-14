import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
import {
  addRoomCandidate,
  castRoomVote,
  createRoom,
  fetchRoom,
  loadSession,
  loadSoloRoomId,
  saveSoloRoomId,
  shareRoomInvite,
  roomInviteUrl,
  type RoomSession,
  type RoomState,
} from "@/lib/rooms/client";

type Vote = -2 | 0 | 1;
type Screen = "start" | "match";
type Candidate = {
  id: string;
  title: string;
  source: "starter" | "memory" | "url" | "manual";
  sourcePlatform?: string;
  sourceUrl?: string;
};
type Memory = Record<string, { uses: number; items: Record<string, { sum: number; count: number; decisions: number }> }>;

// Cold-start suggestion pool for the "다음엔 더 잘 골라줄게" learning card.
// Was previously indexed by mode+situation (혼자/둘이/셋이/더 많이 × 먹기/놀기/쉬기/아무거나);
// now that 둘이/셋이/더 많이 live in the shared-room flow (app/room.tsx) instead of here,
// only the 혼자·아무거나 pool is reachable, so it's kept as a flat constant.
const LEARNING_POOL = ["산책", "카페", "영화", "서점", "전시"];
const MEMORY_KEY = "whatshallwe-memory";
const DECISIONS_KEY = "whatshallwe-decisions";
// Single local voter key for votes/answered bookkeeping. 혼자 always has exactly
// one voter, so this replaces the old participants[]/voterIndex pass-the-phone state.
const ME = "나";
const ink = "#292824";
const candidateApiUrl = process.env.EXPO_PUBLIC_CANDIDATE_API_URL;

const sharedPlatform = (url: string) => url.includes("catchtable") ? "catchtable" : "naver-map";
const sharedPlaceName = (line: string) => line.replace(" 어때요?", "").replace(" 어때요!", "").replace("에서 확인해보세요!", "").replace("에서 확인해보세요.", "").trim();

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function HomeButton({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="처음으로" hitSlop={10} style={styles.homeButton}><View style={styles.homeArc}/><View style={styles.homeRoof}/><View style={styles.homeWall}><View style={styles.homeDoor}/></View></Pressable>;
}

function InviteButton({ roomId }: { roomId: string | null }) {
  const invite = async () => {
    if (!roomId) return;
    const result = await shareRoomInvite(roomId);
    if (result === "copied") Alert.alert("링크를 복사했어요", "카카오톡이나 메시지에 붙여넣어 친구에게 보내세요.");
    else if (result === "shown") Alert.alert("공유 링크", roomInviteUrl(roomId), [{ text: "확인" }]);
  };
  return <Pressable onPress={invite} accessibilityRole="link" accessibilityLabel="친구에게 이 방 공유" style={styles.inviteButton}><Text style={styles.inviteLabel}>친구 초대</Text><View style={styles.inviteSketch}><View style={styles.inviteSketchBody}/><View style={styles.inviteSketchTop}/><View style={styles.inviteSketchBottom}/></View></Pressable>;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("start");
  const [nameInput, setNameInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasSavedSolo, setHasSavedSolo] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [votes, setVotes] = useState<Record<string, Record<string, Vote>>>({});
  const [memory, setMemory] = useState<Memory>({});
  const [showResult, setShowResult] = useState(false);
  const [decided, setDecided] = useState(false);
  const [learnIndex, setLearnIndex] = useState<number | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importErrorType, setImportErrorType] = useState<ImportErrorType | undefined>(undefined);
  const [fallback, setFallback] = useState<{ url: string; title: string; sourcePlatform?: string } | null>(null);
  const cardX = useRef(new Animated.Value(0)).current;
  const learnX = useRef(new Animated.Value(0)).current;
  // Resolved once on mount so "혼자 바로 시작" can reuse the saved room
  // synchronously without waiting on another AsyncStorage round trip.
  const soloRoom = useRef<{ roomId: string; session: RoomSession } | null>(null);

  useEffect(() => { AsyncStorage.getItem(MEMORY_KEY).then(value => { if (value) setMemory(JSON.parse(value)); }).catch(() => undefined); }, []);
  useEffect(() => {
    loadSoloRoomId().then(async (savedRoomId) => {
      if (!savedRoomId) return;
      const savedSession = await loadSession(savedRoomId);
      if (!savedSession) return;
      soloRoom.current = { roomId: savedRoomId, session: savedSession };
      setHasSavedSolo(true);
    }).catch(() => undefined);
  }, []);

  const relation = "solo::self";
  const currentIndex = candidates.findIndex(c => votes[c.id]?.[ME] === undefined);
  const answered = candidates.filter(c => votes[c.id]?.[ME] !== undefined).length;
  const allAnswered = candidates.length > 0 && answered === candidates.length;
  const learning = useMemo(() => LEARNING_POOL.filter(x => !candidates.some(c => c.title === x)).slice(0, 5), [candidates]);

  const saveMemory = (next: Memory) => { setMemory(next); AsyncStorage.setItem(MEMORY_KEY, JSON.stringify(next)).catch(() => undefined); };

  const hydrateFromRoom = (room: RoomState, participantId: string) => {
    setCandidates(room.candidates.map(c => ({ id: c.id, title: c.title, source: c.sourceUrl ? "url" : "manual", sourceUrl: c.sourceUrl ?? undefined })));
    const nextVotes: Record<string, Record<string, Vote>> = {};
    room.candidates.forEach(c => { const mine = c.votes[participantId]; if (mine !== undefined) nextVotes[c.id] = { [ME]: mine }; });
    setVotes(nextVotes);
  };

  const openMatch = () => { setShowResult(false); setDecided(false); setLearnIndex(null); setScreen("match"); };

  const handleSoloStart = async () => {
    if (starting) return;
    setStartError(null); setStarting(true);
    try {
      if (soloRoom.current) {
        const room = await fetchRoom(soloRoom.current.roomId, soloRoom.current.session.token);
        hydrateFromRoom(room, soloRoom.current.session.id);
        setRoomId(soloRoom.current.roomId); setSession(soloRoom.current.session);
      } else {
        const displayName = nameInput.trim() || "나";
        const created = await createRoom(displayName);
        await saveSoloRoomId(created.roomId);
        soloRoom.current = created; setHasSavedSolo(true);
        setRoomId(created.roomId); setSession(created.session);
        setCandidates([]); setVotes({});
      }
      openMatch();
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "여는 데 실패했어요. 다시 시도해 주세요.");
    } finally {
      setStarting(false);
    }
  };
  const handleTogetherStart = async () => {
    if (starting) return;
    const displayName = nameInput.trim();
    if (!displayName) { setStartError("친구에게 보일 이름을 입력해 주세요."); return; }
    setStartError(null); setStarting(true);
    try {
      const created = await createRoom(displayName);
      router.replace(`/room?id=${created.roomId}`);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "방을 만들지 못했어요. 다시 시도해 주세요.");
      setStarting(false);
    }
  };

  const vote = (kind: Vote) => {
    const current = candidates[currentIndex]; if (!current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotes(old => ({ ...old, [current.id]: { ...(old[current.id] ?? {}), [ME]: kind } })); cardX.setValue(0);
    if (roomId && session) castRoomVote(roomId, session.token, current.id, kind).catch(() => undefined);
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
  const votesFor = (candidate: Candidate) => Object.values(votes[candidate.id] ?? {});
  const score = (candidate: Candidate) => { const values = votesFor(candidate); return values.length ? values.reduce((sum: number, v) => sum + v, 0) / values.length : -999; };
  const ordered = [...candidates].sort((a, b) => score(b) - score(a));
  const reason = (candidate: Candidate) => { const avg = score(candidate); return avg >= 0.5 ? "다들 끌리는 선택" : avg >= 0 ? "무난한 선택" : "지금은 별로야"; };
  const persistVotes = () => {
    const next = { ...memory }; next[relation] ??= { uses: 0, items: {} }; next[relation].uses += 1;
    candidates.forEach(c => { votesFor(c).forEach(v => { next[relation].items[c.title] ??= { sum: 0, count: 0, decisions: 0 }; next[relation].items[c.title].sum += v; next[relation].items[c.title].count += 1; }); });
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

  const addImportedCandidate = async (title: string, source: Candidate["source"], sourcePlatform?: string, sourceUrl?: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (sourceUrl && candidates.some(c => c.sourceUrl === sourceUrl)) return;
    let id = uid();
    if (roomId && session) {
      try { id = await addRoomCandidate(roomId, session.token, trimmed, sourceUrl); }
      catch { /* offline or server hiccup: still add locally so the swipe isn't blocked */ }
    }
    setCandidates(prev => [...prev, { id, title: trimmed, source, sourcePlatform, sourceUrl }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const submitImportUrl = async () => {
    const pasted = importUrl.trim();
    const lines = pasted.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const sharedUrl = pasted.match(/https?:\/\/[^\s\]\)]+/i)?.[0];
    const naverSharedTitle = pasted.match(/\[?네이버지도\]?\s*([\s\S]*?)(?=\s*(?:서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)\s|https?:\/\/|\[https?:\/\/)/i)?.[1]?.trim();
    const catchtableSharedTitle = pasted.split(/캐치테이블에서 확인해보세요/i)[0]?.trim();
    const sharedTitle = sharedUrl
      ? (naverSharedTitle || (catchtableSharedTitle && !catchtableSharedTitle.includes("http") ? catchtableSharedTitle : lines.find(line => !line.includes(sharedUrl) && !["[네이버지도]", "네이버지도", "[카카오맵]", "카카오맵", "[캐치테이블]", "캐치테이블", "캐치테이블에서 확인해보세요!", "캐치테이블에서 확인해보세요"].includes(line) && !line.includes("http") && !["서울 ", "경기 ", "인천 ", "부산 ", "대구 ", "대전 ", "광주 ", "울산 ", "세종 ", "강원 ", "충북 ", "충남 ", "전북 ", "전남 ", "경북 ", "경남 ", "제주 "].some(prefix => line.startsWith(prefix)))))
      : undefined;
    if (sharedUrl && sharedTitle) {
      await addImportedCandidate(sharedPlaceName(sharedTitle), "url", sharedPlatform(sharedUrl), sharedUrl);
      setImportUrl("");
      return;
    }
    const url = sharedUrl ?? pasted;
    setImportError(null); setImportErrorType(undefined);
    if (!url) return;
    if (candidateApiUrl) {
      try {
        const response = await fetch(`${candidateApiUrl}/api/candidate-link`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
        const resolved = await response.json() as { ok: boolean; title?: string; sourcePlatform?: string };
        if (resolved.ok && resolved.title) { await addImportedCandidate(resolved.title, "url", resolved.sourcePlatform, url); setImportUrl(""); return; }
      } catch { /* fall back to local parsing */ }
    }
    const result = await createCandidateFromUrl(url);
    const needsTitleConfirmation = result.errorType === "invalid_url" || result.errorType === "unsupported_platform" || result.candidate.title.includes("제목 미확인");
    if (result.ok || !needsTitleConfirmation) {
      await addImportedCandidate(result.candidate.title, "url", result.candidate.sourcePlatform, result.candidate.sourceUrl);
      setImportUrl("");
    } else {
      setImportError(result.reason ?? "장소 정보를 정확히 가져오지 못했어요. 장소 이름만 적어주세요.");
      setImportErrorType(result.errorType);
      setFallback({ url, title: result.candidate.title, sourcePlatform: result.candidate.sourcePlatform });
    }
  };
  const confirmFallback = async () => {
    if (!fallback) return;
    await addImportedCandidate(fallback.title, "manual", fallback.sourcePlatform ?? "manual", fallback.url);
    setFallback(null); setImportUrl(""); setImportError(null); setImportErrorType(undefined);
  };
  const cancelFallback = () => { setFallback(null); setImportError(null); setImportErrorType(undefined); setImportUrl(""); };
  const removeCandidate = (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    setVotes(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  if (screen === "start") return <SafeAreaView style={styles.page}><View style={[styles.modePage, { justifyContent: "center" }]}><View style={[styles.modeTitleArea, { paddingTop: 0 }]}><Text style={styles.title}>누구랑 뭐할까?</Text><View style={styles.titleUnderline}/></View><View style={[styles.modeControlArea, { marginTop: 40 }]}><Text style={styles.inputLabel}>내 이름</Text><TextInput value={nameInput} onChangeText={setNameInput} placeholder="예: 유진" placeholderTextColor="#a29e94" style={styles.input} /><Pressable style={[styles.candidateStartButton, starting && styles.disabled]} disabled={starting} onPress={handleSoloStart}><Text style={styles.candidateStartText}>{starting ? "여는 중…" : hasSavedSolo ? "혼자 이어서 하기" : "혼자 바로 시작"}</Text></Pressable><Pressable style={[styles.togetherButton, starting && styles.disabled]} disabled={starting} onPress={handleTogetherStart}><Text style={styles.togetherButtonText}>링크 만들어서 같이 하기</Text></Pressable>{startError && <Text style={styles.importErrorText}>{startError}</Text>}</View></View></SafeAreaView>;

  const current = candidates[currentIndex];
return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.matchPage}><View style={[styles.header, { justifyContent: "flex-end" }]}><InviteButton roomId={roomId} /></View><Text style={[styles.matchTitle, { textAlign: "center" }]}>혼자 뭐 하지?</Text><View style={[styles.candidatesHead, { justifyContent: "flex-end" }]}><Text style={styles.progress}>{answered}/{candidates.length}</Text></View><View style={styles.importRow}><TextInput value={importUrl} onChangeText={setImportUrl} autoCapitalize="none" autoCorrect={false} style={styles.importInput} /><Pressable style={styles.importButton} onPress={submitImportUrl}><Text style={styles.importButtonText}>추가</Text></Pressable></View>{importError && !fallback && <Text style={styles.importErrorText}>{importError}</Text>}{fallback && <View style={styles.fallbackBox}><Text style={styles.importErrorText}>{importError}</Text><TextInput value={fallback.title} onChangeText={title => setFallback(f => f ? { ...f, title } : f)} placeholder="장소 이름만 적어줘" placeholderTextColor="#a29e94" style={styles.fallbackInput} /><View style={styles.fallbackButtons}><Pressable style={styles.fallbackConfirm} onPress={confirmFallback}><Text style={styles.importButtonText}>이 이름으로 추가</Text></Pressable><Pressable style={styles.fallbackCancel} onPress={cancelFallback}><Text style={styles.fallbackCancelText}>취소</Text></Pressable></View></View>}{candidates.length > 0 && <View style={styles.chipRow}>{candidates.map(c => <View key={c.id} style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{c.title}</Text>{(c.source === "url" || c.source === "manual") && <Pressable onPress={() => removeCandidate(c.id)} hitSlop={8}><Text style={styles.chipRemove}>×</Text></Pressable>}</View>)}</View>}{current ? <Animated.View {...candidatePan.panHandlers} style={[styles.card, { transform: [{ translateX: cardX }, { rotate: cardX.interpolate({ inputRange: [-200, 0, 200], outputRange: ["-8deg", "0deg", "8deg"] }) }] }]}><Text style={styles.cardNumber}>후보 {currentIndex + 1}</Text><Text style={styles.cardTitle}>{current.title}</Text>{current.source === "memory" && <Text style={styles.memoryBadge}>우리 기억</Text>}<View style={styles.hint}><Text>← 별로</Text><Text>탭 · 괜찮아</Text><Text>좋아 →</Text></View></Animated.View> : <View style={[styles.card, styles.completeCard, styles.emptyCandidateCard]}><Text style={[styles.cardTitle, styles.emptyCandidateTitle]}>오늘 후보를 추가해 줘</Text><Text style={[styles.completeText, styles.emptyCandidateText]}>네이버 지도나 캐치테이블 공유 내용을 붙여넣어봐</Text></View>}{allAnswered && !showResult && <Pressable style={styles.resultButton} onPress={openResult}><Text style={styles.resultButtonText}>결과 보기</Text></Pressable>}{showResult && <View style={styles.resultBox}><Text style={styles.resultEyebrow}>오늘은 이 순서 어때?</Text>{ordered.map((c, i) => <View key={c.id} style={styles.resultRow}><Text style={[styles.rank, i === 0 && styles.topRank]}>{i + 1}</Text><View><Text style={styles.resultTitle}>{c.title}</Text><Text style={styles.resultReason}>{reason(c)}</Text></View></View>)}<Pressable style={[styles.resultButton, decided && styles.disabled]} disabled={decided} onPress={decide}><Text style={styles.resultButtonText}>{decided ? "결정했어 ✓" : `1위 ${ordered[0]?.title}로 결정하기 ✓`}</Text></Pressable>{decided && <Text style={styles.decision}>이걸로 가자! 다음엔 이 선택도 기억할게.</Text>}</View>}{learnIndex !== null && <View style={styles.learnBox}><Text style={styles.learnTitle}>다음엔 더 잘 골라줄게</Text><Text style={styles.learnText}>원하면 가볍게 넘겨줘.</Text>{learnIndex < learning.length ? <Animated.View {...learnPan.panHandlers} style={[styles.learnCard, { transform: [{ translateX: learnX }] }]}><Text style={styles.learnProgress}>{learnIndex + 1} / {learning.length}</Text><Text style={styles.learnName}>{learning[learnIndex]}</Text><Text style={styles.learnHint}>← 별로 · ↑ 진짜 좋아 · 좋아 →</Text></Animated.View> : <Text style={styles.decision}>기억했어. 다음 선택에 반영할게 ✨</Text>}{learnIndex < learning.length && <View style={styles.voteButtons}><Pressable onPress={() => remember(-2)} style={styles.voteButton}><Text>별로</Text></Pressable><Pressable onPress={() => remember(2)} style={styles.voteButton}><Text>진짜 좋아</Text></Pressable><Pressable onPress={() => remember(1)} style={styles.voteButton}><Text>좋아</Text></Pressable></View>}</View>}</ScrollView><View style={styles.homeBottom}><HomeButton onPress={() => setScreen("start")} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({
page: { flex: 1, backgroundColor: "#f4f0e6" }, modePage: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 32 }, modeTitleArea: { alignItems: "center", paddingTop: "12%" }, title: { fontFamily: "Gaegu_700Bold", fontSize: 48, color: ink, transform: [{ rotate: "-1deg" }] }, titleLine: { color: ink, fontSize: 16, marginTop: -14, opacity: 0.72 }, modeControlArea: { width: "100%", alignItems: "stretch", paddingHorizontal: 6 }, matchPage: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 132 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, invite: { borderWidth: 1, borderColor: "#77736b", paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 }, matchTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 39, marginTop: 34, marginBottom: 8 }, memoryNote: { marginTop: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "#8d877a", borderRadius: 12, color: "#767269", padding: 11, fontSize: 16 }, candidatesHead: { marginTop: 30, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, candidatesTitle: { fontFamily: "Gaegu_700Bold", color: ink, fontSize: 23 }, progress: { color: "#767269", borderWidth: 1, borderColor: "#9e998d", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 2, fontFamily: "Gaegu_700Bold", fontSize: 16 }, card: { height: 320, borderWidth: 1.5, borderColor: ink, borderRadius: 2, backgroundColor: "#faf8f1", marginTop: 42, alignItems: "center", justifyContent: "center", padding: 20 }, cardNumber: { color: "#767269", fontSize: 20 }, cardTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 40, marginTop: 7, textAlign: "center" }, memoryBadge: { marginTop: 10, paddingHorizontal: 10, paddingVertical: 2, borderWidth: 1, borderStyle: "dashed", borderColor: "#77736b", borderRadius: 12, color: "#625e56", fontSize: 16 }, hint: { position: "absolute", bottom: 19, left: 17, right: 17, flexDirection: "row", justifyContent: "space-between", color: "#767269" }, completeCard: { height: 270 }, completeText: { color: "#767269", fontFamily: "Gaegu_400Regular", fontSize: 19, lineHeight: 24, textAlign: "center", paddingHorizontal: 12, marginTop: 8 }, resultButton: { backgroundColor: ink, borderRadius: 13, padding: 14, alignItems: "center", marginTop: 20 }, resultButtonText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 21 }, resultBox: { borderWidth: 1.5, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1", padding: 18, marginTop: 18 }, resultEyebrow: { fontFamily: "Gaegu_700Bold", fontSize: 29, color: ink, marginBottom: 8 }, resultRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#d8d2c5", paddingVertical: 11, gap: 12 }, rank: { color: ink, borderWidth: 1.2, borderColor: ink, borderRadius: 20, overflow: "hidden", width: 34, height: 34, textAlign: "center", paddingTop: 5, fontFamily: "Gaegu_700Bold", fontSize: 19 }, topRank: { backgroundColor: ink, color: "#faf8f1" }, resultTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 23 }, resultReason: { color: "#767269", fontSize: 15 }, disabled: { opacity: 0.5 }, decision: { color: ink, fontFamily: "Gaegu_700Bold", textAlign: "center", marginTop: 14, fontSize: 18 }, learnBox: { marginTop: 20, borderWidth: 1.3, borderColor: ink, borderRadius: 24, backgroundColor: "#faf8f1", padding: 18 }, learnTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 25 }, learnText: { color: "#767269", fontSize: 17 }, learnCard: { borderWidth: 1, borderColor: "#aaa397", borderRadius: 20, alignItems: "center", padding: 22, marginTop: 15, backgroundColor: "#f7f4eb" }, learnProgress: { color: "#767269", fontFamily: "Gaegu_700Bold" }, learnName: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 32, marginTop: 8 }, learnHint: { color: "#767269", marginTop: 18, fontSize: 14 }, voteButtons: { flexDirection: "row", gap: 8, marginTop: 10 }, voteButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: "#77736b", borderRadius: 12 },
  titleUnderline: { width: "82%", marginTop: 1, height: 8, borderBottomWidth: 2, borderBottomColor: "#4c4943", borderRadius: 50, transform: [{ rotate: "-1deg" }], opacity: 0.72 },
  inputLabel: { marginTop: 0, color: "#767269", fontFamily: "Gaegu_700Bold", fontSize: 18 },
  input: { fontSize: 21, color: ink, borderBottomWidth: 1.5, borderBottomColor: "#68645c", paddingVertical: 8, marginBottom: 8 },
  candidateStartButton: { marginTop: 26, minHeight: 72, borderRadius: 15, backgroundColor: ink, alignItems: "center", justifyContent: "center" },
  candidateStartText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 24 },
  togetherButton: { marginTop: 14, minHeight: 64, borderRadius: 15, borderWidth: 1.5, borderColor: ink, alignItems: "center", justifyContent: "center" },
  togetherButtonText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 22 },
  homeButton: { width: 92, height: 82, alignItems: "center", justifyContent: "flex-end", paddingBottom: 3 },
  homeBottom: { position: "absolute", left: 0, right: 0, bottom: 42, alignItems: "center" },
  homeArc: { position: "absolute", top: 0, width: 86, height: 43, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: "#656159", borderTopLeftRadius: 43, borderTopRightRadius: 43, borderBottomWidth: 0, opacity: 0.78 },
  homeRoof: { position: "absolute", top: 35, width: 28, height: 28, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: ink, transform: [{ rotate: "45deg" }] },
  homeWall: { width: 25, height: 23, borderLeftWidth: 2.5, borderRightWidth: 2.5, borderBottomWidth: 2.5, borderColor: ink, alignItems: "center", justifyContent: "flex-end" },
  homeDoor: { width: 7, height: 11, borderWidth: 2, borderBottomWidth: 0, borderColor: ink },
  emptyCandidateCard: { backgroundColor: "#fffefb", borderWidth: 1.5, borderColor: "#8a8375", borderStyle: "dashed", borderRadius: 18, overflow: "hidden", paddingHorizontal: 18 },
  emptyCandidateTitle: { fontSize: 34, lineHeight: 42, marginTop: 0 },
  emptyCandidateText: { marginTop: 12 },
  inviteButton: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: "#77736b", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
  inviteLabel: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 },
  inviteSketch: { width: 19, height: 18, position: "relative" },
  inviteSketchBody: { position: "absolute", left: 8, top: 2, width: 2, height: 17, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "44deg" }] },
  inviteSketchTop: { position: "absolute", right: 1, top: 1, width: 10, height: 2, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "-5deg" }] },
  inviteSketchBottom: { position: "absolute", right: 1, top: 2, width: 2, height: 10, backgroundColor: ink, borderRadius: 2, transform: [{ rotate: "-5deg" }] },
  importRow: { flexDirection: "row", gap: 8, marginTop: 18, alignItems: "center" },
  importInput: { flex: 1, fontFamily: "Gaegu_400Regular", fontSize: 19, color: ink, borderWidth: 1, borderColor: "#9e998d", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#faf8f1" },
  importButton: { borderRadius: 12, backgroundColor: ink, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  importButtonText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 16 },
  importErrorText: { marginTop: 8, color: "#8a5a3d", fontSize: 14 },
  fallbackBox: { marginTop: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#8d877a", borderRadius: 12, padding: 12, backgroundColor: "#faf8f1" },
  fallbackInput: { marginTop: 8, fontFamily: "Gaegu_400Regular", fontSize: 19, color: ink, borderWidth: 1, borderColor: "#9e998d", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff" },
  fallbackButtons: { flexDirection: "row", gap: 8, marginTop: 10 },
  fallbackConfirm: { flex: 1, borderRadius: 12, backgroundColor: ink, paddingVertical: 10, alignItems: "center" },
  fallbackCancel: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: "#77736b", paddingVertical: 10, alignItems: "center" },
  fallbackCancelText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 16 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "#77736b", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: "#f4f0e6", maxWidth: 180 },
  chipText: { color: ink, fontSize: 14 },
  chipRemove: { color: "#767269", fontSize: 16, fontFamily: "Gaegu_700Bold" },
});
