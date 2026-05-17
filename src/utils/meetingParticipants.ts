import {
  findUserByLineId,
  isPendingProfileName,
  listUsers,
} from "../sheets/repositories/users.js";

const ALL_KEYWORDS = [
  "ทุกคน",
  "ทั้งหมด",
  "all",
  "everyone",
  "คนทั้งหมด",
  "คนเข้าประชุมทั้งหมด",
  "ทุกคนในระบบ",
  "ทุกคนในชีท",
  "ทุกคนใน sheet",
] as const;

/** True when text means "all active users in Users sheet". */
export function isAllParticipantsKeyword(text: string): boolean {
  const n = text.trim().toLowerCase();
  if (!n) return false;
  if (ALL_KEYWORDS.some((k) => n === k.toLowerCase())) return true;
  if (/ทุกคน/.test(n) && /(ประชุม|เข้า|ในระบบ|ในชีท|sheet)/.test(n)) return true;
  if (/ทั้งหมด/.test(n) && /(คน|ประชุม|เข้า)/.test(n)) return true;
  return false;
}

export function splitParticipantNames(participants: string): string[] {
  return participants
    .split(/[,，、\n]/)
    .map((s) => s.trim())
    .filter((s) => s && !isAllParticipantsKeyword(s));
}

export async function listActiveParticipantNames(): Promise<string[]> {
  const users = await listUsers();
  return users
    .filter(
      (u) =>
        u.active &&
        u.lineUserId.trim() &&
        !isPendingProfileName(u.name),
    )
    .map((u) => u.name.trim());
}

export async function resolveMeetingParticipants(input: {
  participantMode?: string;
  participants?: string;
  mentionLineUserIds?: string[];
  mentionAll?: boolean;
}): Promise<{ names: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const nameSet = new Set<string>();

  const wantAll =
    Boolean(input.mentionAll) ||
    input.participantMode === "all_active" ||
    isAllParticipantsKeyword(input.participants ?? "");

  if (wantAll) {
    const all = await listActiveParticipantNames();
    if (!all.length) {
      warnings.push("ไม่พบผู้ใช้ active ใน Sheet ที่ลงทะเบียนครบแล้ว");
    }
    for (const n of all) nameSet.add(n);
  }

  const rawParticipants = (input.participants ?? "").trim();
  if (rawParticipants && !isAllParticipantsKeyword(rawParticipants)) {
    for (const n of splitParticipantNames(rawParticipants)) {
      nameSet.add(n);
    }
  }

  for (const lineUserId of input.mentionLineUserIds ?? []) {
    const u = await findUserByLineId(lineUserId);
    if (u?.name && !isPendingProfileName(u.name)) {
      nameSet.add(u.name.trim());
    } else {
      warnings.push(
        `ผู้ใช้ LINE …${lineUserId.slice(-6)} ยังไม่มีในแท็บ Users หรือยังไม่ตั้งชื่อ`,
      );
    }
  }

  return { names: [...nameSet], warnings };
}

export async function formatLineMentionHint(input: {
  mentionAll: boolean;
  lineUserIds: string[];
}): Promise<string | undefined> {
  if (!input.mentionAll && !input.lineUserIds.length) return undefined;

  const lines: string[] = ["[ข้อมูลจาก LINE mention — ใช้ตอนนัดประชุม]"];
  if (input.mentionAll) {
    lines.push(
      "- @all → ใช้ create_meeting participantMode=all_active (ดึงทุกคน active จาก Sheet)",
    );
  }
  for (const id of input.lineUserIds) {
    const u = await findUserByLineId(id);
    if (u?.name && !isPendingProfileName(u.name)) {
      lines.push(`- @mention → ${u.name} (มีใน Sheet)`);
    } else {
      lines.push(
        `- @mention (LINE …${id.slice(-6)}) → ยังไม่มีใน Sheet แจ้งให้ลงทะเบียนก่อน`,
      );
    }
  }
  return lines.join("\n");
}
