import { config } from "../config.js";
import { listMeetings } from "../sheets/repositories/meetings.js";
import { pushText } from "../line/client.js";
import { cronMeetingReminderText } from "../messaging/persona.js";
import { resolveLineUserIdByName } from "../utils/resolveUser.js";
import { updateMeetingCell } from "../sheets/repositories/meetings.js";
import { logActivity } from "../audit/logActivity.js";

function parseMeetingTime(s: string): Date | null {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

export async function runMeetingReminders(): Promise<void> {
  const now = Date.now();
  const windowMs = config.MEETING_NOTIFY_HOURS_BEFORE * 60 * 60 * 1000;
  const meetings = await listMeetings();

  for (const row of meetings) {
    const start = parseMeetingTime(row.datetime);
    if (!start) continue;
    const msUntil = start.getTime() - now;
    if (msUntil < 0 || msUntil > windowMs) continue;

    if (row.notifiedAt.trim()) continue;

    const names = row.participants
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const name of names) {
      const lineUserId = await resolveLineUserIdByName(name);
      if (!lineUserId) {
        console.warn(`Meeting "${row.title}": no lineUserId for "${name}"`);
        continue;
      }
      const text = cronMeetingReminderText({
        participantName: name,
        title: row.title,
        datetime: row.datetime,
      });
      await pushText(lineUserId, text);
    }

    await updateMeetingCell(
      row.rowIndex,
      "notifiedAt",
      new Date().toISOString(),
    );
    await logActivity({
      actor: "cron:meetings",
      action: "meeting_notified",
      entityType: "meeting",
      entityId: String(row.rowIndex),
      details: row.title,
    });
  }
}
