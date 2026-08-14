import { neon } from "@neondatabase/serverless";
import { randomBytes, randomUUID } from "crypto";

export type VoteValue = -2 | 0 | 1;
export type RoomState = { roomId: string; participants: { id: string; displayName: string }[]; candidates: { id: string; title: string; sourceUrl: string | null; votes: Record<string, VoteValue> }[] };
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not configured.");
const sql = neon(connectionString);
let schemaReady: Promise<void> | undefined;
export function badRequest(res: any, message: string, status = 400) { res.status(status).json({ ok: false, reason: message }); }
export async function ensureSchema() {
  schemaReady ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS shared_rooms (id varchar(24) PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS room_participants (id uuid PRIMARY KEY, room_id varchar(24) NOT NULL REFERENCES shared_rooms(id) ON DELETE CASCADE, display_name varchar(40) NOT NULL, participant_token varchar(80) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS room_candidates (id uuid PRIMARY KEY, room_id varchar(24) NOT NULL REFERENCES shared_rooms(id) ON DELETE CASCADE, title varchar(120) NOT NULL, source_url text, created_at timestamptz NOT NULL DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS room_votes (candidate_id uuid NOT NULL REFERENCES room_candidates(id) ON DELETE CASCADE, participant_id uuid NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE, value smallint NOT NULL CHECK (value IN (-2, 0, 1)), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (candidate_id, participant_id))`;
  })(); return schemaReady;
}
const newRoomId = () => randomBytes(6).toString("base64url").toLowerCase();
const newToken = () => randomBytes(32).toString("base64url");
export async function createRoom(name: string) { await ensureSchema(); const roomId = newRoomId(), participant = { id: randomUUID(), token: newToken(), displayName: name }; await sql`INSERT INTO shared_rooms (id) VALUES (${roomId})`; await sql`INSERT INTO room_participants (id, room_id, display_name, participant_token) VALUES (${participant.id}, ${roomId}, ${name}, ${participant.token})`; return { roomId, participant }; }
export async function joinRoom(roomId: string, name: string) { await ensureSchema(); if (!(await sql`SELECT id FROM shared_rooms WHERE id = ${roomId}`).length) return; const participant = { id: randomUUID(), token: newToken(), displayName: name }; await sql`INSERT INTO room_participants (id, room_id, display_name, participant_token) VALUES (${participant.id}, ${roomId}, ${name}, ${participant.token})`; return participant; }
export async function participantFor(roomId: string, token: string) { await ensureSchema(); return (await sql`SELECT id, display_name FROM room_participants WHERE room_id = ${roomId} AND participant_token = ${token}`)[0] as { id: string; display_name: string } | undefined; }
export async function getRoom(roomId: string): Promise<RoomState | undefined> { await ensureSchema(); if (!(await sql`SELECT id FROM shared_rooms WHERE id = ${roomId}`).length) return; const participants = await sql`SELECT id, display_name FROM room_participants WHERE room_id = ${roomId} ORDER BY created_at`; const candidates = await sql`SELECT id, title, source_url FROM room_candidates WHERE room_id = ${roomId} ORDER BY created_at`; const votes = await sql`SELECT v.candidate_id, v.participant_id, v.value FROM room_votes v INNER JOIN room_candidates c ON c.id = v.candidate_id WHERE c.room_id = ${roomId}`; return { roomId, participants: participants.map((p: any) => ({ id: p.id, displayName: p.display_name })), candidates: candidates.map((c: any) => ({ id: c.id, title: c.title, sourceUrl: c.source_url, votes: Object.fromEntries(votes.filter((v: any) => v.candidate_id === c.id).map((v: any) => [v.participant_id, v.value])) })) }; }
export async function addCandidate(roomId: string, token: string, title: string, sourceUrl?: string) { if (!(await participantFor(roomId, token))) return; const id = randomUUID(); await sql`INSERT INTO room_candidates (id, room_id, title, source_url) VALUES (${id}, ${roomId}, ${title}, ${sourceUrl ?? null})`; return id; }
export async function saveVote(roomId: string, token: string, candidateId: string, value: VoteValue) { const participant = await participantFor(roomId, token); if (!participant || !(await sql`SELECT id FROM room_candidates WHERE id = ${candidateId} AND room_id = ${roomId}`).length) return false; await sql`INSERT INTO room_votes (candidate_id, participant_id, value) VALUES (${candidateId}, ${participant.id}, ${value}) ON CONFLICT (candidate_id, participant_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`; return true; }
export const validName = (value: unknown) => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 40;
export const validTitle = (value: unknown) => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 120;
