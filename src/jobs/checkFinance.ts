import { config } from "../config.js";
import {
  listFinance,
  updateFinanceCell,
} from "../sheets/repositories/finance.js";
import { pushText } from "../line/client.js";
import { cronFinanceReminderText } from "../messaging/persona.js";
import {
  resolveLineUserIdByName,
  resolveManagerLineIdForPerson,
} from "../utils/resolveUser.js";
import { logActivity } from "../audit/logActivity.js";

import {
  daysBetween,
  parseDueDate,
  startOfDay,
} from "../utils/dateHelpers.js";

export async function runFinanceReminders(): Promise<void> {
  const today = startOfDay(new Date());
  const rows = await listFinance();
  const remindBefore = config.FINANCE_REMIND_DAYS_BEFORE;

  for (const row of rows) {
    if (row.status !== "unpaid") continue;
    const due = parseDueDate(row.dueDate);
    if (!due) continue;
    const daysUntil = daysBetween(due, today);
    if (daysUntil > remindBefore) continue;

    const responsibleName = row.responsible.trim() || row.name.trim();
    const lineUserId = await resolveLineUserIdByName(responsibleName);
    if (!lineUserId) {
      console.warn(
        `Finance row ${row.rowIndex}: no lineUserId for "${responsibleName}"`,
      );
      continue;
    }

    const last = row.lastReminderAt?.trim();
    if (last) {
      const lastDay = startOfDay(new Date(last));
      if (lastDay.getTime() === today.getTime()) continue;
    }

    const daysOverdue = daysUntil < 0 ? -daysUntil : 0;
    const tone =
      daysOverdue >= config.FINANCE_ESCALATE_USER_DAYS ? "urgent" : "polite";

    const text = cronFinanceReminderText({
      recipientName: responsibleName,
      itemName: row.name,
      amount: row.amount,
      dueDate: row.dueDate,
      tone,
      daysOverdue,
    });
    await pushText(lineUserId, text);
    await updateFinanceCell(
      row.rowIndex,
      "lastReminderAt",
      today.toISOString().slice(0, 10),
    );
    await logActivity({
      actor: "cron:finance",
      action: "reminder_sent",
      entityType: "finance",
      entityId: String(row.rowIndex),
      details: `${row.name} → ${responsibleName}`,
    });
  }
}

/** Escalate overdue payments: user (3d+) and manager (7d+) */
export async function runFinanceEscalation(): Promise<void> {
  const today = startOfDay(new Date());
  const todayStr = today.toISOString().slice(0, 10);
  const rows = await listFinance();

  for (const row of rows) {
    if (row.status !== "unpaid") continue;
    const due = parseDueDate(row.dueDate);
    if (!due) continue;
    const daysOverdue = -daysBetween(due, today);
    if (daysOverdue < config.FINANCE_ESCALATE_USER_DAYS) continue;

    const responsibleName = row.responsible.trim() || row.name.trim();
    const lastEsc = row.lastEscalationAt?.trim();
    if (lastEsc === todayStr) continue;

    if (daysOverdue >= config.FINANCE_ESCALATE_MANAGER_DAYS) {
      const managerLine = await resolveManagerLineIdForPerson(responsibleName);
      if (managerLine) {
        const text = cronFinanceReminderText({
          recipientName: responsibleName,
          itemName: row.name,
          amount: row.amount,
          dueDate: row.dueDate,
          tone: "escalation",
          daysOverdue,
        });
        await pushText(managerLine, text);
        await logActivity({
          actor: "cron:escalation",
          action: "manager_notified",
          entityType: "finance",
          entityId: String(row.rowIndex),
          details: responsibleName,
        });
      }
    } else {
      const lineUserId = await resolveLineUserIdByName(responsibleName);
      if (lineUserId) {
        await pushText(
          lineUserId,
          cronFinanceReminderText({
            recipientName: responsibleName,
            itemName: row.name,
            amount: row.amount,
            dueDate: row.dueDate,
            tone: "urgent",
            daysOverdue,
          }),
        );
        await logActivity({
          actor: "cron:escalation",
          action: "urgent_reminder",
          entityType: "finance",
          entityId: String(row.rowIndex),
          details: responsibleName,
        });
      }
    }

    await updateFinanceCell(row.rowIndex, "lastEscalationAt", todayStr);
  }
}
