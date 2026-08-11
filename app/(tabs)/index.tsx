import { useMemo, useRef, useState } from "react";
import {
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

type Mode = "solo" | "duo" | "trio" | "group";
type Feeling = "eat" | "play" | "chill" | "any";
type Vote = "no" | "okay" | "yes";

const MODES: { id: Mode; label: string; dots: string }[] = [
  { id: "solo", label: "혼자", dots: "·" },
  { id: "duo", label: "둘이", dots: "··" },
  { id: "trio", label: "친구들", dots: "···" },
  { id: "group", label: "모임", dots: "····" },
];

const FEELINGS: { id: Feeling; label: string }[] = [
  { id: "eat", label: "먹기" },
  { id: "play", label: "놀기" },
  { id: "chill", label: "쉬기" },
  { id: "any", label: "아무거나" },
];

const OPTIONS: Record<Mode, Record<Feeling, string[]>> = {
  solo: { eat: ["라멘", "브런치", "떡볶이"], play: ["영화", "서점", "전시"], chill: ["카페", "공원 산책", "책 읽기"], any: ["산책", "카페", "영화"] },
  duo: { eat: ["파스타", "초밥", "마라탕"], play: ["볼링", "전시", "방탈출"], chill: ["카페", "드라이브", "한강 피크닉"], any: ["라멘", "카페", "영화"] },
  trio: { eat: ["삼겹살", "마라탕", "피자"], play: ["볼링", "보드게임 카페", "코인노래방"], chill: ["대형 카페", "한강", "만화카페"], any: ["초밥", "볼링", "보드게임 카페"] },
  group: { eat: ["삼겹살", "치킨", "닭갈비"], play: ["방탈출", "볼링", "노래방"], chill: ["루프탑", "한강 피크닉", "대형 카페"], any: ["삼겹살", "방탈출", "보드게임 카페"] },
};

export default function HomeScreen() {
  const [screen, setScreen] = useState<"mode" | "setup" | "match">("mode");
  const [mode, setMode] = useState<Mode>("solo");
  const [partner, setPartner] = useState("");
  const [feeling, setFeeling] = useState<Feeling>("any");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [votes, setVotes] = useState<Vote[]>([]);
  const swipe = useRef(new Animated.ValueXY()).current;
  const candidates = useMemo(() => OPTIONS[mode][feeling], [mode, feeling]);
  const allDone = candidateIndex >= candidates.length;

  const startMatching = (nextFeeling: Feeling) => {
    setFeeling(nextFeeling);
    setCandidateIndex(0);
    setVotes([]);
    setScreen("match");
  };

  const choose = (vote: Vote) => {
    if (allDone) return;
    const direction = vote === "no" ? -1 : vote === "yes" ? 1 : 0;
    const complete = () => {
      setVotes((current) => [...current, vote]);
      setCandidateIndex((current) => current + 1);
      swipe.setValue({ x: 0, y: 0 });
    };
    if (!direction) return complete();
    Animated.timing(swipe, { toValue: { x: direction * 440, y: 0 }, duration: 180, useNativeDriver: true }).start(complete);
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: swipe.x, dy: swipe.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 70) choose("yes");
        else if (gesture.dx < -70) choose("no");
        else Animated.spring(swipe, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
      },
    }),
    [swipe, candidateIndex, candidates.length],
  );

  const ranked = candidates
    .map((title, index) => ({ title, score: votes[index] === "yes" ? 2 : votes[index] === "okay" ? 1 : 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.paper}>
        <View pointerEvents="none" style={styles.paperGrain} />
        {screen === "mode" && (
          <View style={styles.modeScreen}>
            <Text style={styles.heroTitle}>누구랑 뭐할까?</Text>
            <View style={styles.sliderLine} />
            <View style={styles.modeChoices}>
              {MODES.map((item) => (
                <Pressable key={item.id} onPress={() => { setMode(item.id); setScreen("setup"); }} style={[styles.modeChip, item.id === mode && styles.modeChipActive]}>
                  <Text style={styles.modeDots}>{item.dots}</Text>
                  <Text style={styles.modeLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sliderHint}>같이할 사람을 골라봐</Text>
          </View>
        )}

        {screen === "setup" && (
          <ScrollView contentContainerStyle={styles.setupScreen} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => setScreen("mode")}><Text style={styles.back}>← 돌아가기</Text></Pressable>
            <View style={styles.sketchCard}>
              <Text style={styles.sectionTitle}>지금 뭐가 당겨?</Text>
              {mode !== "solo" && <><Text style={styles.fieldLabel}>함께할 사람</Text><TextInput value={partner} onChangeText={setPartner} placeholder="예: 민수" placeholderTextColor="#9a958a" style={styles.input} /></>}
              <View style={styles.feelingGrid}>
                {FEELINGS.map((item) => <Pressable key={item.id} onPress={() => startMatching(item.id)} style={({ pressed }) => [styles.feeling, pressed && styles.pressed]}><Text style={styles.feelingText}>{item.label}</Text></Pressable>)}
              </View>
            </View>
          </ScrollView>
        )}

        {screen === "match" && (
          <ScrollView contentContainerStyle={styles.matchScreen} showsVerticalScrollIndicator={false}>
            <View style={styles.topbar}><Pressable onPress={() => setScreen("mode")}><Text style={styles.back}>← 처음으로</Text></Pressable><Pressable style={styles.invite}><Text style={styles.inviteText}>친구 초대 〽</Text></Pressable></View>
            <Text style={styles.matchTitle}>오늘 뭐 하지?</Text>
            <View style={styles.candidateHeader}><Text style={styles.candidateLabel}>오늘 후보</Text><Text style={styles.progress}>{Math.min(candidateIndex + 1, candidates.length)}/{candidates.length}</Text></View>
            {!allDone ? (
              <>
                <View style={styles.swipeArea}>
                  <Animated.View {...panResponder.panHandlers} style={[styles.candidateCard, { transform: [{ translateX: swipe.x }, { translateY: Animated.multiply(swipe.y, 0.08) }, { rotate: swipe.x.interpolate({ inputRange: [-250, 0, 250], outputRange: ["-8deg", "-0.4deg", "8deg"] }) }] }]}>
                    <Text style={styles.candidateNumber}>후보 {candidateIndex + 1}</Text>
                    <Text style={styles.candidateTitle}>{candidates[candidateIndex]}</Text>
                    <Text style={styles.gestureHint}>← 별로    탭 · 괜찮아    좋아 →</Text>
                  </Animated.View>
                </View>
                <View style={styles.voteRow}><Pressable onPress={() => choose("no")} style={styles.voteButton}><Text style={styles.voteText}>별로</Text></Pressable><Pressable onPress={() => choose("okay")} style={styles.voteButton}><Text style={styles.voteText}>괜찮아</Text></Pressable><Pressable onPress={() => choose("yes")} style={styles.voteButton}><Text style={styles.voteText}>좋아</Text></Pressable></View>
              </>
            ) : (
              <View style={styles.resultCard}>
                <Text style={styles.doneScribble}>다 골랐어</Text>
                <Text style={styles.resultTitle}>오늘은 이 순서 어때?</Text>
                {ranked.map((item, index) => <View key={item.title} style={styles.resultRow}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.resultName}>{item.title}</Text>{index === 0 && <Text style={styles.pick}>오늘의 선택</Text>}</View>)}
                <Pressable style={styles.decide}><Text style={styles.decideText}>{ranked[0]?.title}로 결정하기 ✓</Text></Pressable>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const ink = "#292824";
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f0e6" }, paper: { flex: 1, backgroundColor: "#f4f0e6" }, paperGrain: { ...StyleSheet.absoluteFillObject, opacity: 0.22, borderWidth: 1, borderColor: "#ded9cd" },
  modeScreen: { flex: 1, justifyContent: "center", paddingHorizontal: 24 }, heroTitle: { color: ink, fontSize: 42, fontWeight: "800", textAlign: "center", letterSpacing: -2 }, sliderLine: { height: 2, backgroundColor: "#57544c", marginTop: 82, marginHorizontal: 15, transform: [{ rotate: "-0.5deg" }] },
  modeChoices: { flexDirection: "row", justifyContent: "space-between", marginTop: -49 }, modeChip: { alignItems: "center", justifyContent: "center", width: 76, height: 94, borderWidth: 1.4, borderColor: "#6e6a61", borderRadius: 40, backgroundColor: "#faf8f1", shadowColor: ink, shadowOpacity: 0.08, shadowOffset: { width: 2, height: 3 }, shadowRadius: 1 }, modeChipActive: { borderWidth: 2 }, modeDots: { color: ink, fontSize: 24, lineHeight: 24 }, modeLabel: { color: ink, fontSize: 17, fontWeight: "700", marginTop: 7 }, sliderHint: { textAlign: "center", marginTop: 40, fontSize: 16, color: "#767269" },
  setupScreen: { flexGrow: 1, justifyContent: "center", padding: 22 }, back: { color: "#767269", fontSize: 17, fontWeight: "600", marginBottom: 22 }, sketchCard: { borderWidth: 1.5, borderColor: "#3f3d38", borderRadius: 24, padding: 24, backgroundColor: "#faf8f1", shadowColor: ink, shadowOpacity: 0.08, shadowOffset: { width: 2, height: 3 }, shadowRadius: 1 }, sectionTitle: { color: ink, fontSize: 32, fontWeight: "800", textAlign: "center", letterSpacing: -1.5 }, fieldLabel: { color: "#767269", fontSize: 17, fontWeight: "700", marginTop: 32 }, input: { borderBottomWidth: 1.5, borderColor: "#59564e", color: ink, fontSize: 20, paddingVertical: 9 }, feelingGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 30 }, feeling: { alignItems: "center", justifyContent: "center", width: "47%", minHeight: 62, borderWidth: 1.2, borderColor: "#777269", borderRadius: 22 }, feelingText: { color: ink, fontSize: 22, fontWeight: "800" }, pressed: { transform: [{ scale: 0.97 }], borderWidth: 2 },
  matchScreen: { padding: 22, paddingBottom: 48 }, topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, invite: { borderWidth: 1.2, borderColor: "#59564e", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }, inviteText: { color: ink, fontSize: 16, fontWeight: "700" }, matchTitle: { color: ink, fontSize: 38, fontWeight: "800", textAlign: "center", marginTop: 25, letterSpacing: -2 }, candidateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1.4, borderColor: "#45423c", borderRadius: 16, backgroundColor: "#faf8f1aa", padding: 16, marginTop: 28 }, candidateLabel: { color: ink, fontSize: 21, fontWeight: "800" }, progress: { borderWidth: 1, borderColor: "#767269", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 3, color: "#767269", fontSize: 15, fontWeight: "700" }, swipeArea: { height: 332, justifyContent: "center", marginTop: 18 }, candidateCard: { height: 305, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#3f3d38", borderRadius: 24, backgroundColor: "#faf8f1", padding: 24, shadowColor: ink, shadowOpacity: 0.1, shadowOffset: { width: 2, height: 4 }, shadowRadius: 2 }, candidateNumber: { color: "#767269", fontSize: 17 }, candidateTitle: { color: ink, fontSize: 39, fontWeight: "800", marginTop: 12, letterSpacing: -2 }, gestureHint: { position: "absolute", bottom: 20, color: "#767269", fontSize: 15, fontWeight: "700" }, voteRow: { flexDirection: "row", gap: 8 }, voteButton: { flex: 1, alignItems: "center", borderWidth: 1.2, borderColor: "#777269", borderRadius: 13, paddingVertical: 13 }, voteText: { color: ink, fontSize: 18, fontWeight: "800" },
  resultCard: { marginTop: 20, borderWidth: 1.7, borderColor: "#3f3d38", borderRadius: 23, backgroundColor: "#faf8f1", padding: 22 }, doneScribble: { color: "#767269", fontSize: 19, textAlign: "center" }, resultTitle: { color: ink, fontSize: 29, fontWeight: "800", marginTop: 8, marginBottom: 14 }, resultRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#cbc5b8", paddingVertical: 13 }, rank: { width: 31, height: 31, textAlign: "center", paddingTop: 4, borderWidth: 1.3, borderColor: ink, borderRadius: 16, color: ink, fontSize: 17, fontWeight: "800" }, resultName: { flex: 1, color: ink, fontSize: 21, fontWeight: "800", marginLeft: 12 }, pick: { color: "#767269", fontSize: 14 }, decide: { backgroundColor: ink, borderRadius: 14, paddingVertical: 15, marginTop: 20, alignItems: "center" }, decideText: { color: "#faf8f1", fontSize: 20, fontWeight: "800" },
});
