import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type ActivityLogRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.activityLogs}!A2:Z`;

export async function listActivityLogs(limit = 100): Promise<ActivityLogRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: ActivityLogRow[] = [];
  let rowIndex = 2;
  for (const row of values) {
    const r = row as string[];
    if (!cell(r, 0) && !cell(r, 2)) {
      rowIndex++;
      continue;
    }
    out.push({
      rowIndex,
      timestamp: cell(r, 0),
      actor: cell(r, 1),
      action: cell(r, 2),
      entityType: cell(r, 3),
      entityId: cell(r, 4),
      details: cell(r, 5),
    });
    rowIndex++;
  }
  return out.slice(-limit).reverse();
}

export async function appendActivityLog(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}): Promise<void> {
  const sheets = getSheets();
  const ts = new Date().toISOString();
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.activityLogs}!A:F`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          ts,
          params.actor,
          params.action,
          params.entityType,
          params.entityId,
          params.details,
        ],
      ],
    },
  });
}

export function colLetterForActivity(
  field: (typeof COLS.activityLogs)[number],
): string {
  const idx = COLS.activityLogs.indexOf(field);
  return String.fromCharCode("A".charCodeAt(0) + idx);
}
