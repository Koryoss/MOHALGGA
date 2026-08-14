import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";

/**
 * Single shared client for the /api/rooms backend (Neon Postgres via
 * api/_shared/rooms.ts). Both app/index.tsx (혼자 — now backed by a
 * 1-participant room) and app/room.tsx (같이 — multi-participant) go
 * through this module instead of each keeping their own fetch/session
 * logic, so the two screens can't drift out of sync with each other or
 * with the API contract.
 */

export type VoteValue = -2 | 0 | 1;
export type RoomParticipant = { id: string; displayName: string };
export type RoomCandidate = { id: string; title: string; sourceUrl: string | null; votes: Record<string, VoteValue> };
export type RoomState = { roomId: string; participants: RoomParticipant[]; candidates: RoomCandidate[] };
export type RoomSession = { id: string; token: string; displayName: string };

// Relative path works on web (same origin as the API). Native has no
// document origin to resolve against, so it needs the deployed host.
const WEB_API_BASE = "/api/rooms";
const REMOTE_API_BASE = "https://mohalgga.vercel.app/api/rooms";
export const roomApiBase = Platform.OS === "web" ? WEB_API_BASE : REMOTE_API_BASE;

export const roomSessionKey = (roomId: string) => `mohalgga-room-${roomId}`;
/** Points at the one persistent room a device uses for 혼자 sessions, so re-opening "혼자 바로 시작" resumes instead of creating a fresh room every time. */
const SOLO_ROOM_POINTER_KEY = "whatshallwe-solo-room-id";

async function readJson(url: string, options?: RequestInit) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.reason ?? "다시 시도해 주세요.");
  return data;
}

function toSession(participant: { id: string; token: string; displayName: string }): RoomSession {
  return { id: participant.id, token: participant.token, displayName: participant.displayName };
}

export async function createRoom(name: string): Promise<{ roomId: string; session: RoomSession }> {
  const data = await readJson(roomApiBase, { method: "POST", body: JSON.stringify({ name }) });
  const session = toSession(data.participant);
  await AsyncStorage.setItem(roomSessionKey(data.roomId), JSON.stringify(session));
  return { roomId: data.roomId as string, session };
}

export async function joinRoom(roomId: string, name: string): Promise<RoomSession> {
  const data = await readJson(`${roomApiBase}/${roomId}/join`, { method: "POST", body: JSON.stringify({ name }) });
  const session = toSession(data.participant);
  await AsyncStorage.setItem(roomSessionKey(roomId), JSON.stringify(session));
  return session;
}

export async function loadSession(roomId: string): Promise<RoomSession | null> {
  const raw = await AsyncStorage.getItem(roomSessionKey(roomId));
  return raw ? (JSON.parse(raw) as RoomSession) : null;
}

export async function fetchRoom(roomId: string, token: string): Promise<RoomState> {
  const data = await readJson(`${roomApiBase}/${roomId}?participantToken=${encodeURIComponent(token)}`);
  return data.room as RoomState;
}

export async function addRoomCandidate(roomId: string, token: string, title: string, sourceUrl?: string): Promise<string> {
  const data = await readJson(`${roomApiBase}/${roomId}/candidates`, { method: "POST", body: JSON.stringify({ participantToken: token, title, sourceUrl }) });
  return data.candidateId as string;
}

export async function castRoomVote(roomId: string, token: string, candidateId: string, value: VoteValue): Promise<void> {
  await readJson(`${roomApiBase}/${roomId}/votes`, { method: "PUT", body: JSON.stringify({ participantToken: token, candidateId, value }) });
}

export async function loadSoloRoomId(): Promise<string | null> {
  return AsyncStorage.getItem(SOLO_ROOM_POINTER_KEY);
}

export async function saveSoloRoomId(roomId: string): Promise<void> {
  await AsyncStorage.setItem(SOLO_ROOM_POINTER_KEY, roomId);
}

export function roomInviteUrl(roomId: string): string {
  if (Platform.OS === "web" && typeof window !== "undefined") return `${window.location.origin}/room?id=${roomId}`;
  return `https://mohalgga.vercel.app/room?id=${roomId}`;
}

/**
 * Shared "invite a friend to this room" action used by both the solo swipe
 * screen's InviteButton and the shared-room screen's own invite button.
 * Returns what actually happened so the caller can decide what (if
 * anything) to tell the user.
 */
export async function shareRoomInvite(roomId: string): Promise<"shared" | "copied" | "shown" | "cancelled"> {
  const url = roomInviteUrl(roomId);
  const message = `mohalgga에서 같이 골라보자!\n${url}`;
  if (Platform.OS === "web") {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "mohalgga 같이 고르기", text: "mohalgga에서 같이 골라보자!", url });
        return "shared";
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return "cancelled";
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      return "copied";
    }
    return "shown";
  }
  try {
    await Share.share({ title: "mohalgga 같이 고르기", message, url });
    return "shared";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    return "shown";
  }
}
