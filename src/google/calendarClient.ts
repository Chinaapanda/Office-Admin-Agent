import { google, type calendar_v3 } from "googleapis";
import { config } from "../config.js";
import { getServiceAccountCredentials } from "./credentials.js";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

let calendarClient: calendar_v3.Calendar | null = null;

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(config.GOOGLE_CALENDAR_ID?.trim());
}

async function getCalendarAuth() {
  const creds = getServiceAccountCredentials();
  const jwt = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [CALENDAR_SCOPE],
    subject: config.GOOGLE_CALENDAR_SUBJECT?.trim() || undefined,
  });
  await jwt.authorize();
  return jwt;
}

export async function getCalendar(): Promise<calendar_v3.Calendar> {
  if (calendarClient) return calendarClient;
  const auth = await getCalendarAuth();
  calendarClient = google.calendar({ version: "v3", auth });
  return calendarClient;
}

export function calendarId(): string {
  const id = config.GOOGLE_CALENDAR_ID?.trim();
  if (!id) throw new Error("GOOGLE_CALENDAR_ID is not set");
  return id;
}
