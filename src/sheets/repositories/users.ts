import { getSheets, spreadsheetId } from "../client.js";
import { COLS, TABS, type UserRow } from "../schemas.js";
import { cell } from "../parse.js";

const RANGE = `${TABS.users}!A2:Z`;

/** Placeholder name prefix for users who have not completed profile via chat */
export const PENDING_PROFILE_NAME_PREFIX = "(รอยืนยัน-";

export function isPendingProfileName(name: string): boolean {
  const n = name.trim();
  return !n || n.startsWith(PENDING_PROFILE_NAME_PREFIX);
}

import { parseActiveFlag } from "../../utils/userActive.js";

export async function listUsers(): Promise<UserRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const out: UserRow[] = [];
  let rowIndex = 2;
  for (const row of values) {
    const r = row as string[];
    if (!cell(r, 0) && !cell(r, 1)) {
      rowIndex++;
      continue;
    }
    out.push({
      rowIndex,
      name: cell(r, 0),
      lineUserId: cell(r, 1),
      email: cell(r, 2),
      role: (cell(r, 3) || "user").toLowerCase(),
      department: cell(r, 4),
      manager: cell(r, 5),
      active: parseActiveFlag(cell(r, 6)),
    });
    rowIndex += 1;
  }
  return out;
}

export async function findUserByLineId(
  lineUserId: string,
): Promise<UserRow | undefined> {
  const id = lineUserId.trim();
  const users = await listUsers();
  return users.find((u) => u.lineUserId.trim() === id);
}

export async function appendUser(params: {
  name: string;
  lineUserId: string;
  email?: string;
  role?: string;
  department?: string;
  manager?: string;
  active?: boolean;
}): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: RANGE,
  });
  const values = res.data.values ?? [];
  const rowIndex = 2 + values.length;
  const active = params.active !== false ? "yes" : "no";
  await sheets.spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.users}!A:G`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          params.name,
          params.lineUserId,
          params.email ?? "",
          params.role ?? "user",
          params.department ?? "",
          params.manager ?? "",
          active,
        ],
      ],
    },
  });
  return rowIndex;
}

/** Register LINE user on follow if not already present */
export async function registerLineUserOnFollow(
  lineUserId: string,
): Promise<{ created: boolean; rowIndex?: number }> {
  const existing = await findUserByLineId(lineUserId);
  if (existing) return { created: false };
  const suffix = lineUserId.slice(-4);
  const rowIndex = await appendUser({
    name: `${PENDING_PROFILE_NAME_PREFIX}${suffix})`,
    lineUserId,
    role: "user",
    active: true,
  });
  return { created: true, rowIndex };
}

export async function updateUserCell(
  rowIndex: number,
  field: (typeof COLS.users)[number],
  value: string,
): Promise<void> {
  const colIndex = COLS.users.indexOf(field);
  const colLetter = String.fromCharCode("A".charCodeAt(0) + colIndex);
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId(),
    range: `${TABS.users}!${colLetter}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

export function colLetterForUser(field: (typeof COLS.users)[number]): string {
  const idx = COLS.users.indexOf(field);
  return String.fromCharCode("A".charCodeAt(0) + idx);
}
