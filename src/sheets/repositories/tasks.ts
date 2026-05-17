import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type TaskRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.tasks}!A2:Z`;

export async function listTasks(): Promise<TaskRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: TaskRow[] = [];
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
      status: cell(r, 1).toLowerCase() || "pending",
      assignee: cell(r, 2),
      dueDate: cell(r, 3),
      sourceType: cell(r, 4),
      sourceId: cell(r, 5),
      createdAt: cell(r, 6),
    });
    rowIndex++;
  }
  return out;
}

export async function appendTask(params: {
  title: string;
  assignee: string;
  dueDate?: string;
  sourceType?: string;
  sourceId?: string;
  status?: string;
}): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const rowIndex = 2 + values.length;
  const createdAt = new Date().toISOString().slice(0, 10);
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.tasks}!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          params.title,
          params.status ?? "pending",
          params.assignee,
          params.dueDate ?? "",
          params.sourceType ?? "",
          params.sourceId ?? "",
          createdAt,
        ],
      ],
    },
  });
  return rowIndex;
}

export async function updateTaskCell(
  rowIndex: number,
  field: (typeof COLS.tasks)[number],
  value: string,
): Promise<void> {
  const colIndex = COLS.tasks.indexOf(field);
  const colLetter = String.fromCharCode("A".charCodeAt(0) + colIndex);
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.tasks}!${colLetter}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}
