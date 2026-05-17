import { config } from "../config.js";
import { listFinance } from "../sheets/repositories/finance.js";
import { monthlyFinanceSummaryText } from "../messaging/persona.js";
import { pushText } from "../line/client.js";
import { logActivity } from "../audit/logActivity.js";

function parseAmount(s: string): number {
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export async function runMonthlyFinanceSummary(): Promise<void> {
  const adminId = config.ADMIN_LINE_USER_ID?.trim();
  if (!adminId) {
    console.warn("ADMIN_LINE_USER_ID not set; skip monthly summary push");
    return;
  }

  const now = new Date();
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthPrefix = monthLabel;

  const rows = await listFinance();
  const inMonth = rows.filter((r) => r.dueDate.startsWith(monthPrefix));
  const unpaid = inMonth.filter((r) => r.status === "unpaid");
  const lines = unpaid.map(
    (r) =>
      `- ${r.name}: ${r.amount} (${r.recordType || "expense"}) due ${r.dueDate}`,
  );
  let totalUnpaid = 0;
  let totalIncome = 0;
  let totalExpense = 0;
  for (const r of inMonth) {
    const n = parseAmount(r.amount);
    if (r.recordType === "income") totalIncome += n;
    else totalExpense += n;
    if (r.status === "unpaid") totalUnpaid += n;
  }
  const text = monthlyFinanceSummaryText({
    monthLabel,
    lines,
    totalUnpaid: String(totalUnpaid),
    totalIncome: String(totalIncome),
    totalExpense: String(totalExpense),
  });
  await pushText(adminId, text);
  await logActivity({
    actor: "cron:monthly",
    action: "summary_sent",
    entityType: "finance",
    details: monthLabel,
  });
}
