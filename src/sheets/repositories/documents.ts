import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type DocumentRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.documents}!A2:Z`;

export async function listDocuments(): Promise<DocumentRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: DocumentRow[] = [];
  let rowIndex = 2;
  for (const row of values) {
    const r = row as string[];
    if (!cell(r, 0)) {
      rowIndex++;
      continue;
    }
    out.push({
      rowIndex,
      name: cell(r, 0),
      documentType: cell(r, 1),
      status: cell(r, 2).toLowerCase() || "missing",
      owner: cell(r, 3),
      lastRequestAt: cell(r, 4),
      dueDate: cell(r, 5),
      assignedTo: cell(r, 6),
    });
    rowIndex++;
  }
  return out;
}

export async function appendDocument(params: {
  name: string;
  documentType: string;
  owner: string;
  status?: string;
  dueDate?: string;
  assignedTo?: string;
}): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const rowIndex = 2 + values.length;
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.documents}!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          params.name,
          params.documentType,
          params.status ?? "missing",
          params.owner,
          "",
          params.dueDate ?? "",
          params.assignedTo ?? "",
        ],
      ],
    },
  });
  return rowIndex;
}

export async function updateDocumentCell(
  rowIndex: number,
  field: (typeof COLS.documents)[number],
  value: string,
): Promise<void> {
  const colIndex = COLS.documents.indexOf(field);
  const colLetter = String.fromCharCode("A".charCodeAt(0) + colIndex);
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.documents}!${colLetter}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

/** Document still needs follow-up from ops perspective */
export function isDocumentOpen(status: string): boolean {
  const s = status.toLowerCase();
  return s !== "completed" && s !== "rejected" && s !== "received";
}
