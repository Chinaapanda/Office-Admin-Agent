import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3003),
  PUBLIC_BASE_URL: z.string().optional(),

  GOOGLE_SPREADSHEET_ID: z.string().min(1),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  /** Shared or primary calendar ID; enables Calendar invites when set */
  GOOGLE_CALENDAR_ID: z.string().optional(),
  /** Workspace user to impersonate (required for email invites in most orgs) */
  GOOGLE_CALENDAR_SUBJECT: z.string().optional(),
  GOOGLE_CALENDAR_TIMEZONE: z.string().default("Asia/Bangkok"),

  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),
  LINE_CHANNEL_SECRET: z.string().min(1),

  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  CRON_FINANCE: z.string().default("0 9 * * *"),
  CRON_DOCUMENTS: z.string().default("5 9 * * *"),
  CRON_MEETINGS: z.string().default("*/15 * * * *"),
  CRON_ESCALATION: z.string().default("30 9 * * *"),

  FINANCE_REMIND_DAYS_BEFORE: z.coerce.number().default(3),
  FINANCE_ESCALATE_USER_DAYS: z.coerce.number().default(3),
  FINANCE_ESCALATE_MANAGER_DAYS: z.coerce.number().default(7),
  MEETING_NOTIFY_HOURS_BEFORE: z.coerce.number().default(24),
  ADMIN_LINE_USER_ID: z.string().optional(),

  DASHBOARD_TOKEN: z.string().optional(),

  AGENT_MAX_TOOL_ROUNDS: z.coerce.number().default(5),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadEnv(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  const e = parsed.data;
  if (!e.GOOGLE_APPLICATION_CREDENTIALS && !e.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON",
    );
  }
  return e;
}

export const config = loadEnv();
