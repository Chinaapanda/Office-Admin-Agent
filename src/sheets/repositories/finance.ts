import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type FinanceRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.finance}!A2:Z`;

export async function listFinance(): Promise<FinanceRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: FinanceRow[] = [];
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
      amount: cell(r, 1),
      status: cell(r, 2).toLowerCase() || "unpaid",
      dueDate: cell(r, 3),
      responsible: cell(r, 4),
      lastReminderAt: cell(r, 5),
      category: cell(r, 6),
      recordType: (cell(r, 7) || "expense").toLowerCase(),
      lastEscalationAt: cell(r, 8),
    });
    rowIndex++;
  }
  return out;
}

export async function appendFinance(params: {
  name: string;
  amount: string;
  dueDate: string;
  responsible?: string;
  category?: string;
  recordType?: "income" | "expense";
  status?: "paid" | "unpaid";
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
    range: `${TABS.finance}!A:I`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          params.name,
          params.amount,
          params.status ?? "unpaid",
          params.dueDate,
          params.responsible ?? "",
          "",
          params.category ?? "",
          params.recordType ?? "expense",
          "",
        ],
      ],
    },
  });
  return rowIndex;
}

export async function updateFinanceCell(
  rowIndex: number,
  field: (typeof COLS.finance)[number],
  value: string,
): Promise<void> {
  const colIndex = COLS.finance.indexOf(field);
  const colLetter = String.fromCharCode("A".charCodeAt(0) + colIndex);
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.finance}!${colLetter}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}
