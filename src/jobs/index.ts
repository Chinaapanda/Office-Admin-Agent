import cron from "node-cron";
import { config } from "../config.js";
import { runFinanceReminders, runFinanceEscalation } from "./checkFinance.js";
import { runDocumentReminders } from "./checkDocuments.js";
import { runMeetingReminders } from "./checkMeetings.js";
import { runMonthlyFinanceSummary } from "./monthlySummary.js";

function wrap(name: string, fn: () => Promise<void>): () => void {
  return () => {
    void fn().catch((err) => console.error(`[cron:${name}]`, err));
  };
}

export function registerCronJobs(): void {
  cron.schedule(config.CRON_FINANCE, wrap("finance", runFinanceReminders));
  cron.schedule(
    config.CRON_ESCALATION,
    wrap("escalation", runFinanceEscalation),
  );
  cron.schedule(
    config.CRON_DOCUMENTS,
    wrap("documents", runDocumentReminders),
  );
  cron.schedule(config.CRON_MEETINGS, wrap("meetings", runMeetingReminders));
  cron.schedule("0 8 1 * *", wrap("monthlySummary", runMonthlyFinanceSummary));

  console.log("Cron registered:", {
    finance: config.CRON_FINANCE,
    escalation: config.CRON_ESCALATION,
    documents: config.CRON_DOCUMENTS,
    meetings: config.CRON_MEETINGS,
    monthlySummary: "0 8 1 * *",
  });
}
