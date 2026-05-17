/**
 * Create required sheet tabs + header row (row 1) for Kaidow Assistant.
 * Run: pnpm run setup:sheet
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { COLS, TABS } from "../src/sheets/schemas.js";

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
if (!spreadsheetId) {
  console.error("Set GOOGLE_SPREADSHEET_ID in .env");
  process.exit(1);
}

function loadCredentials(): object {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString(
        "utf8",
      ),
    ) as object;
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./credentials.json";
  return JSON.parse(readFileSync(path, "utf8")) as object;
}

const TAB_HEADERS: Record<string, readonly string[]> = {
  [TABS.users]: COLS.users,
  [TABS.finance]: COLS.finance,
  [TABS.documents]: COLS.documents,
  [TABS.meetings]: COLS.meetings,
  [TABS.activityLogs]: COLS.activityLogs,
  [TABS.tasks]: COLS.tasks,
};

const REQUIRED_TABS = Object.values(TABS);

async function main(): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    credentials: loadCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Map(
    (meta.data.sheets ?? []).map((s) => [
      s.properties?.title ?? "",
      s.properties?.sheetId ?? 0,
    ]),
  );

  const requests: object[] = [];

  // Rename lone default "Sheet1" → Users when Users tab is missing
  if (existing.has("Sheet1") && !existing.has(TABS.users)) {
    const sheetId = existing.get("Sheet1")!;
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, title: TABS.users },
        fields: "title",
      },
    });
    existing.delete("Sheet1");
    existing.set(TABS.users, sheetId);
    console.log("Renamed Sheet1 → Users");
  }

  for (const title of REQUIRED_TABS) {
    if (!existing.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
      console.log(`Will add tab: ${title}`);
    }
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  }

  const headerUpdates = REQUIRED_TABS.map((title) => ({
    range: `${title}!A1`,
    values: [[...TAB_HEADERS[title]]],
  }));

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: headerUpdates,
    },
  });

  console.log("Done. Tabs:", REQUIRED_TABS.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
