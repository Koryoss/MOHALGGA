import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { addRoomCandidate, castRoomVote, fetchRoom, joinRoom, loadSession, roomInviteUrl, shareRoomInvite, type RoomSession, type RoomState, type VoteValue } from "@/lib/rooms/client";

const ink = "#292824";

/**
 * Room creation itself now happens on the 이름 입력 → 혼자/같이 분기 screen
 * in app/index.tsx ("혼자 바로 시작" / "링크 만들어서 같이 하기"). This
 * screen's job is only: (a) if a session for this room is already saved
 * on this device, load it; (b) if someone arrived fresh via a friend's
 * invite link, ask for a name and join. There's no "방 만들기" UI here
 * anymore — one screen owns "create a room" instead of two.
 */
export default function SharedRoomScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const roomId = typeof params.id === "string" ? params.id : "";
  const [name, setName] = useState("");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [candidateTitle, setCandidateTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!roomId) router.replace("/"); }, [roomId]);

  const refresh = useCallback(async (activeSession = session) => {
    if (!roomId || !activeSession) return;
    try { setRoom(await fetchRoom(roomId, activeSession.token)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "방을 불러오지 못했어요."); }
  }, [roomId, session]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    loadSession(roomId).then((saved) => {
      if (cancelled) return;
      if (saved) { setSession(saved); refresh(saved); }
      setCheckingSession(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);
  useEffect(() => { if (!session) return; const timer = setInterval(() => refresh(), 3000); return () => clearInterval(timer); }, [session, refresh]);

  const enter = async () => {
    const displayName = name.trim(); if (!displayName) return setError("방에서 쓸 이름을 입력해 주세요.");
    setLoading(true); setError(null);
    try { const nextSession = await joinRoom(roomId, displayName); setSession(nextSession); refresh(nextSession); }
    catch (e) { setError(e instanceof Error ? e.message : "방에 들어가지 못했어요."); }
    finally { setLoading(false); }
  };
  const addCandidate = async () => {
    if (!session || !candidateTitle.trim()) return;
    setLoading(true);
    try { await addRoomCandidate(roomId, session.token, candidateTitle.trim()); setCandidateTitle(""); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "후보를 추가하지 못했어요."); }
    finally { setLoading(false); }
  };
  const vote = async (candidateId: string, value: VoteValue) => {
    if (!session) return;
    try { await castRoomVote(roomId, session.token, candidateId, value); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "투표를 저장하지 못했어요."); }
  };
  const showInvite = async () => {
    const result = await shareRoomInvite(roomId);
    if (result === "copied") Alert.alert("링크를 복사했어요", "카카오톡이나 메시지에 붙여넣어 친구에게 보내세요.");
    else if (result === "shown") Alert.alert("공유 링크", roomInviteUrl(roomId), [{ text: "확인" }]);
  };

  if (!roomId || checkingSession) return <SafeAreaView style={styles.page}><View style={styles.center}><ActivityIndicator color={ink} /></View></SafeAreaView>;

  if (!session) return <SafeAreaView style={styles.page}><View style={styles.center}><Text style={styles.title}>mohalgga</Text><Text style={styles.copy}>같이 고르기 전에, 방에서 쓸 이름을 알려줘.</Text><TextInput value={name} onChangeText={setName} placeholder="예: 유진" style={styles.input} /><Pressable onPress={enter} style={styles.primary}><Text style={styles.primaryText}>{loading ? "들어가는 중…" : "방에 들어가기"}</Text></Pressable>{error && <Text style={styles.error}>{error}</Text>}</View></SafeAreaView>;

  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}><View style={styles.top}><Text style={styles.title}>같이 뭐할까?</Text><Pressable onPress={showInvite} style={styles.outline}><Text style={styles.outlineText}>친구 초대 ↗</Text></Pressable></View><Text style={styles.people}>{room?.participants.map(p => p.displayName).join(", ") || "방을 불러오는 중…"}</Text><Text style={styles.copy}>링크를 받은 친구도 이름만 적으면 바로 참여해. 결과는 자동으로 맞춰져.</Text><View style={styles.addRow}><TextInput value={candidateTitle} onChangeText={setCandidateTitle} placeholder="후보 이름을 추가해 줘" style={styles.addInput} /><Pressable onPress={addCandidate} style={styles.add}><Text style={styles.primaryText}>추가</Text></Pressable></View>{error && <Text style={styles.error}>{error}</Text>}{!room ? <ActivityIndicator color={ink} style={{ marginTop: 40 }} /> : room.candidates.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>첫 후보를 추가해 줘</Text><Text style={styles.copy}>모두에게 바로 보이고, 각자 투표할 수 있어.</Text></View> : room.candidates.map(candidate => { const values = Object.values(candidate.votes); const average = values.length ? values.reduce<number>((sum, value) => sum + value, 0) / values.length : 0; const mine = candidate.votes[session.id]; return <View key={candidate.id} style={styles.card}><Text style={styles.cardTitle}>{candidate.title}</Text><Text style={styles.score}>{values.length ? `${values.length}명 반응 · ${average >= 0.5 ? "다들 끌리는 선택" : average >= 0 ? "무난한 선택" : "지금은 별로야"}` : "아직 반응이 없어요"}</Text><View style={styles.voteRow}>{([[-2, "별로"], [0, "괜찮아"], [1, "좋아"]] as const).map(([value, label]) => <Pressable key={value} onPress={() => vote(candidate.id, value)} style={[styles.vote, mine === value && styles.voteActive]}><Text style={[styles.voteText, mine === value && styles.voteActiveText]}>{label}</Text></Pressable>)}</View></View>; })}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#f4f0e6" }, center: { flex: 1, justifyContent: "center", padding: 28 }, content: { padding: 24, paddingBottom: 64 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, title: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 41 }, copy: { color: "#706c63", fontSize: 18, lineHeight: 25, marginTop: 12 }, people: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 24, marginTop: 28 }, input: { marginTop: 26, backgroundColor: "#faf8f1", borderBottomWidth: 1.5, borderBottomColor: ink, padding: 12, fontSize: 21, color: ink }, primary: { backgroundColor: ink, borderRadius: 14, padding: 15, alignItems: "center", marginTop: 16 }, primaryText: { color: "#faf8f1", fontFamily: "Gaegu_700Bold", fontSize: 20 }, outline: { borderWidth: 1, borderColor: "#77736b", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 }, outlineText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 17 }, addRow: { flexDirection: "row", gap: 8, marginTop: 26 }, addInput: { flex: 1, borderWidth: 1.2, borderColor: "#77736b", borderRadius: 12, backgroundColor: "#faf8f1", paddingHorizontal: 13, fontSize: 18, color: ink }, add: { backgroundColor: ink, borderRadius: 12, paddingHorizontal: 16, justifyContent: "center" }, empty: { marginTop: 30, borderWidth: 1.2, borderStyle: "dashed", borderColor: "#888277", borderRadius: 18, padding: 28, alignItems: "center" }, emptyTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 30 }, card: { marginTop: 18, backgroundColor: "#faf8f1", borderWidth: 1.4, borderColor: ink, borderRadius: 18, padding: 20 }, cardTitle: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 31, textAlign: "center" }, score: { color: "#706c63", fontSize: 16, textAlign: "center", marginTop: 6 }, voteRow: { flexDirection: "row", gap: 8, marginTop: 18 }, vote: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: "#77736b", borderRadius: 11, paddingVertical: 10 }, voteActive: { backgroundColor: ink, borderColor: ink }, voteText: { color: ink, fontFamily: "Gaegu_700Bold", fontSize: 18 }, voteActiveText: { color: "#faf8f1" }, error: { color: "#b5463f", marginTop: 13, fontSize: 16 } });
