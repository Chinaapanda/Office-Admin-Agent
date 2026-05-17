export type MeetingTimeWindow = {
  startDateTime: string;
  endDateTime: string;
};

const TIME_RANGE_RE =
  /^(.+?)[\s,]+(\d{1,2}:\d{2})(?::\d{2})?\s*[-–—]\s*(\d{1,2}:\d{2})(?::\d{2})?$/;

/** Format as Calendar API local datetime (no Z suffix). */
export function toCalendarDateTime(d: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

function mergeDateAndTime(datePart: string, time: string): Date | null {
  const t = time.trim();
  const iso = `${datePart.trim()}T${t.length === 5 ? `${t}:00` : t}`;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * Parse meeting start/end for Google Calendar.
 * Supports ISO strings, "YYYY-MM-DD HH:mm-HH:mm", or default +1h duration.
 */
export function parseMeetingTimeWindow(
  datetime: string,
  endDatetime: string | undefined,
  timeZone: string,
): { ok: true; window: MeetingTimeWindow } | { ok: false; error: string } {
  const raw = datetime.trim();
  if (!raw) return { ok: false, error: "empty datetime" };

  let start: Date | null = null;
  let end: Date | null = null;

  const rangeMatch = raw.match(TIME_RANGE_RE);
  if (rangeMatch) {
    const [, datePart, startTime, endTime] = rangeMatch;
    start = mergeDateAndTime(datePart, startTime);
    end = mergeDateAndTime(datePart, endTime);
    if (!start || !end) {
      return { ok: false, error: `could not parse time range: ${raw}` };
    }
    if (end.getTime() <= start.getTime()) {
      end = addHours(end, 24);
    }
  } else {
    const t = Date.parse(raw);
    if (Number.isNaN(t)) {
      return { ok: false, error: `could not parse datetime: ${raw}` };
    }
    start = new Date(t);
    if (endDatetime?.trim()) {
      const et = Date.parse(endDatetime.trim());
      if (Number.isNaN(et)) {
        return { ok: false, error: `could not parse endDatetime: ${endDatetime}` };
      }
      end = new Date(et);
    } else {
      end = addHours(start, 1);
    }
  }

  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "end must be after start" };
  }

  return {
    ok: true,
    window: {
      startDateTime: toCalendarDateTime(start, timeZone),
      endDateTime: toCalendarDateTime(end, timeZone),
    },
  };
}
