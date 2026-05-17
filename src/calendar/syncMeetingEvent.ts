import { config } from "../config.js";
import {
  calendarId,
  getCalendar,
  isGoogleCalendarConfigured,
} from "../google/calendarClient.js";
import { parseMeetingTimeWindow } from "./parseMeetingTime.js";
import { resolveParticipantEmails } from "./resolveParticipantEmails.js";

export type SyncMeetingCalendarInput = {
  title: string;
  datetime: string;
  endDatetime?: string;
  participantNames: string[];
  notes?: string;
  calendarEventId?: string;
};

export type SyncMeetingCalendarResult = {
  eventId: string;
  htmlLink?: string;
  invitedEmails: string[];
  missingEmail: string[];
  endDatetime: string;
  warnings: string[];
};

export async function syncMeetingToGoogleCalendar(
  input: SyncMeetingCalendarInput,
): Promise<SyncMeetingCalendarResult | null> {
  if (!isGoogleCalendarConfigured()) return null;

  const timeZone = config.GOOGLE_CALENDAR_TIMEZONE;
  const parsed = parseMeetingTimeWindow(
    input.datetime,
    input.endDatetime,
    timeZone,
  );
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const { attendees, missingEmail } = await resolveParticipantEmails(
    input.participantNames,
  );
  const warnings: string[] = [];
  if (missingEmail.length) {
    warnings.push(
      `ไม่มีอีเมลใน Sheet สำหรับ: ${missingEmail.join(", ")} (ไม่ได้ส่ง calendar invite)`,
    );
  }
  if (!config.GOOGLE_CALENDAR_SUBJECT?.trim()) {
    warnings.push(
      "ตั้ง GOOGLE_CALENDAR_SUBJECT (อีเมล Workspace) เพื่อให้ Google ส่ง invite ได้ครบ",
    );
  }

  const calendar = await getCalendar();
  const calId = calendarId();
  const description = [
    input.notes?.trim(),
    `ผู้เข้าร่วม (Sheet): ${input.participantNames.join(", ")}`,
    "สร้างโดย Kaidow Assistant",
  ]
    .filter(Boolean)
    .join("\n");

  const body = {
    summary: input.title,
    description,
    start: {
      dateTime: parsed.window.startDateTime,
      timeZone,
    },
    end: {
      dateTime: parsed.window.endDateTime,
      timeZone,
    },
    attendees: attendees.map((a) => ({
      email: a.email,
      displayName: a.displayName,
    })),
  };

  if (input.calendarEventId) {
    const res = await calendar.events.patch({
      calendarId: calId,
      eventId: input.calendarEventId,
      sendUpdates: "all",
      requestBody: body,
    });
    return {
      eventId: res.data.id ?? input.calendarEventId,
      htmlLink: res.data.htmlLink ?? undefined,
      invitedEmails: attendees.map((a) => a.email),
      missingEmail,
      endDatetime: parsed.window.endDateTime,
      warnings,
    };
  }

  const res = await calendar.events.insert({
    calendarId: calId,
    sendUpdates: "all",
    requestBody: body,
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Calendar API did not return event id");

  console.log("[calendar] event created", {
    eventId,
    attendees: attendees.length,
    title: input.title,
  });

  return {
    eventId,
    htmlLink: res.data.htmlLink ?? undefined,
    invitedEmails: attendees.map((a) => a.email),
    missingEmail,
    endDatetime: parsed.window.endDateTime,
    warnings,
  };
}
