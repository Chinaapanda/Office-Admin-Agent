import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type MeetingRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.meetings}!A2:Z`;

export async function listMeetings(): Promise<MeetingRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: MeetingRow[] = [];
  let rowIndex = 2;
  for (const row of values) {
    const r = row as string[];
    if (!cell(r, 0)) {
      rowIndex++;
      continue;
    }
    out.push({
      rowIndex,
      title: cell(r, 0),
      datetime: cell(r, 1),
      participants: cell(r, 2),
      notifiedAt: cell(r, 3),
      rsvp: cell(r, 4),
      notes: cell(r, 5),
      endDatetime: cell(r, 6),
      calendarEventId: cell(r, 7),
    });
    rowIndex++;
  }
  return out;
}

export async function updateMeetingCell(
  rowIndex: number,
  field: (typeof COLS.meetings)[number],
  value: string,
): Promise<void> {
  const colIndex = COLS.meetings.indexOf(field);
  const colLetter = String.fromCharCode("A".charCodeAt(0) + colIndex);
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.meetings}!${colLetter}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

export async function appendMeeting(
  title: string,
  datetime: string,
  participants: string,
  extras?: { notes?: string; endDatetime?: string },
): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.meetings}!A:H`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          title,
          datetime,
          participants,
          "",
          "",
          extras?.notes ?? "",
          extras?.endDatetime ?? "",
          "",
        ],
      ],
    },
  });
  const updated = res.data.updates?.updatedRange;
  if (updated) {
    const m = updated.match(/!A(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return -1;
}
