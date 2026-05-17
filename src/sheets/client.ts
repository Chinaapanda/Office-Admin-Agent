import { google, type sheets_v4 } from "googleapis";
import { config } from "../config.js";
import { getServiceAccountCredentials } from "../google/credentials.js";

let sheetsClient: sheets_v4.Sheets | null = null;

export function getSheets(): sheets_v4.Sheets {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    credentials: getServiceAccountCredentials(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  sheetsClient = google.sheets({ version: "v4", auth });
  return sheetsClient;
}

export function spreadsheetId(): string {
  return config.GOOGLE_SPREADSHEET_ID;
}
