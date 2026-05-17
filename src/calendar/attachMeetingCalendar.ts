import { updateMeetingCell } from "../sheets/repositories/meetings.js";
import {
  syncMeetingToGoogleCalendar,
  type SyncMeetingCalendarInput,
  type SyncMeetingCalendarResult,
} from "./syncMeetingEvent.js";

export async function attachMeetingCalendar(
  rowIndex: number,
  input: SyncMeetingCalendarInput,
): Promise<{
  calendar: SyncMeetingCalendarResult | null;
  warnings: string[];
}> {
  const warnings: string[] = [];
  try {
    const calendar = await syncMeetingToGoogleCalendar(input);
    if (!calendar) return { calendar: null, warnings };

    await updateMeetingCell(rowIndex, "endDatetime", calendar.endDatetime);
    await updateMeetingCell(rowIndex, "calendarEventId", calendar.eventId);
    warnings.push(...calendar.warnings);
    if (calendar.invitedEmails.length) {
      warnings.push(
        `ส่ง Calendar invite แล้ว ${calendar.invitedEmails.length} อีเมล`,
      );
    }
    return { calendar, warnings };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[calendar] sync failed", msg);
    warnings.push(`Calendar: ${msg}`);
    return { calendar: null, warnings };
  }
}
