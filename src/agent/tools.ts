import type { ChatCompletionTool } from "openai/resources/chat/completions";
import {
  appendFinance,
  listFinance,
  updateFinanceCell,
} from "../sheets/repositories/finance.js";
import {
  appendDocument,
  listDocuments,
  updateDocumentCell,
} from "../sheets/repositories/documents.js";
import {
  appendMeeting,
  listMeetings,
  updateMeetingCell,
} from "../sheets/repositories/meetings.js";
import {
  listUsers,
  updateUserCell,
} from "../sheets/repositories/users.js";
import {
  appendTask,
  listTasks,
  updateTaskCell,
} from "../sheets/repositories/tasks.js";
import { listActivityLogs } from "../sheets/repositories/activity.js";
import { pushText } from "../line/client.js";
import { invalidateUserCache } from "../utils/resolveUser.js";
import type { UserRow } from "../sheets/schemas.js";
import { DOCUMENT_STATUSES, TASK_STATUSES } from "../sheets/schemas.js";
import {
  clearPending,
  getPending,
  setPendingFinancePaid,
} from "./confirm.js";
import { canUseWriteTools, isAdmin } from "./policy.js";
import { logActivity } from "../audit/logActivity.js";
import { resolveMeetingParticipants } from "../utils/meetingParticipants.js";
import { attachMeetingCalendar } from "../calendar/attachMeetingCalendar.js";
import { isGoogleCalendarConfigured } from "../google/calendarClient.js";

export const agentToolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_finance",
      description:
        "List finance rows. Filters: status, name substring, recordType income|expense.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["paid", "unpaid", "all"] },
          nameContains: { type: "string" },
          recordType: { type: "string", enum: ["income", "expense", "all"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_finance",
      description: "Add a finance row (income or expense).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "string" },
          dueDate: { type: "string" },
          responsible: { type: "string" },
          category: { type: "string" },
          recordType: { type: "string", enum: ["income", "expense"] },
          status: { type: "string", enum: ["paid", "unpaid"] },
        },
        required: ["name", "amount", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_finance_status",
      description:
        "Update finance row status. Marking paid requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          rowIndex: { type: "integer" },
          status: { type: "string", enum: ["paid", "unpaid"] },
        },
        required: ["rowIndex", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "List documents with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [...DOCUMENT_STATUSES, "all", "open"],
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_document",
      description: "Request a new document record.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          documentType: { type: "string" },
          owner: { type: "string" },
          dueDate: { type: "string" },
          status: { type: "string" },
        },
        required: ["name", "documentType", "owner"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_document_status",
      description: "Update document status or owner by rowIndex.",
      parameters: {
        type: "object",
        properties: {
          rowIndex: { type: "integer" },
          status: { type: "string", enum: [...DOCUMENT_STATUSES] },
          owner: { type: "string" },
          dueDate: { type: "string" },
        },
        required: ["rowIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_meetings",
      description: "List meetings.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description:
        "Schedule a meeting. Participants: comma-separated names from Users sheet, and/or participantMode=all_active for everyone active in Sheet. LINE @mentions in the user message are applied automatically.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          datetime: {
            type: "string",
            description:
              "Start time ISO or clear Thai text e.g. 2026-05-15T13:00 (Bangkok)",
          },
          participants: {
            type: "string",
            description:
              "Comma-separated names, or keywords ทุกคน/ทั้งหมด/คนเข้าประชุมทั้งหมด",
          },
          participantMode: {
            type: "string",
            enum: ["names", "all_active"],
            description:
              "all_active = every active registered user in Users tab (for ทุกคน/ทั้งหมด)",
          },
          endDatetime: {
            type: "string",
            description:
              "Optional end time ISO or same format as datetime; default +1h or parse 13:00-14:00 in datetime",
          },
          notes: { type: "string" },
        },
        required: ["title", "datetime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_meeting",
      description: "Update meeting by rowIndex.",
      parameters: {
        type: "object",
        properties: {
          rowIndex: { type: "integer" },
          title: { type: "string" },
          datetime: { type: "string" },
          participants: { type: "string" },
          participantMode: {
            type: "string",
            enum: ["names", "all_active"],
          },
          endDatetime: { type: "string" },
          rsvp: { type: "string" },
          notes: { type: "string" },
        },
        required: ["rowIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "List workflow tasks.",
      parameters: {
        type: "object",
        properties: {
          assignee: { type: "string" },
          status: { type: "string", enum: [...TASK_STATUSES, "all"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Create a tracked task.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          assignee: { type: "string" },
          dueDate: { type: "string" },
          sourceType: { type: "string" },
          sourceId: { type: "string" },
        },
        required: ["title", "assignee"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Update task status by rowIndex.",
      parameters: {
        type: "object",
        properties: {
          rowIndex: { type: "integer" },
          status: { type: "string", enum: [...TASK_STATUSES] },
          assignee: { type: "string" },
        },
        required: ["rowIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_activity_logs",
      description: "Recent audit log entries (admin sees more detail).",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notify_user",
      description: "Push LINE message to another user. Admin only.",
      parameters: {
        type: "object",
        properties: {
          lineUserId: { type: "string" },
          message: { type: "string" },
        },
        required: ["lineUserId", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_my_profile",
      description:
        "Save the current user's profile after registration in chat. Requires full name; optional email and department.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name in Thai or English" },
          email: { type: "string" },
          department: { type: "string", description: "Team or department" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_users",
      description: "List registered users.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user",
      description:
        "Update user profile fields. Admin only (or self name/email if allowed).",
      parameters: {
        type: "object",
        properties: {
          rowIndex: { type: "integer" },
          name: { type: "string" },
          email: { type: "string" },
          role: { type: "string" },
          department: { type: "string" },
          manager: { type: "string" },
          active: { type: "string", enum: ["yes", "no"] },
        },
        required: ["rowIndex"],
      },
    },
  },
];

export type ToolContext = {
  lineUserId: string;
  user: UserRow | undefined;
  lineMentions?: { lineUserIds: string[]; mentionAll: boolean };
};

function safeJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function requireWrite(ctx: ToolContext): string | null {
  if (!canUseWriteTools(ctx.user)) {
    return JSON.stringify({ error: "user not allowed to write" });
  }
  return null;
}

export async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<string> {
  const row = (args as Record<string, unknown>) ?? {};

  switch (name) {
    case "list_finance": {
      const status =
        (row.status as string | undefined)?.toLowerCase() ?? "all";
      const nameContains = (row.nameContains as string | undefined)?.trim();
      const recordType =
        (row.recordType as string | undefined)?.toLowerCase() ?? "all";
      let rows = await listFinance();
      if (status === "paid") rows = rows.filter((r) => r.status === "paid");
      else if (status === "unpaid")
        rows = rows.filter((r) => r.status === "unpaid");
      if (recordType === "income")
        rows = rows.filter((r) => r.recordType === "income");
      else if (recordType === "expense")
        rows = rows.filter((r) => r.recordType === "expense");
      if (nameContains) {
        const q = nameContains.toLowerCase();
        rows = rows.filter((r) => r.name.toLowerCase().includes(q));
      }
      return safeJson(rows);
    }
    case "create_finance": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = await appendFinance({
        name: String(row.name ?? "").trim(),
        amount: String(row.amount ?? "").trim(),
        dueDate: String(row.dueDate ?? "").trim(),
        responsible: String(row.responsible ?? ctx.user?.name ?? "").trim(),
        category: String(row.category ?? "").trim(),
        recordType: (row.recordType as "income" | "expense") ?? "expense",
        status: (row.status as "paid" | "unpaid") ?? "unpaid",
      });
      invalidateUserCache();
      await logActivity({
        actor: ctx.user?.name ?? ctx.lineUserId,
        action: "finance_created",
        entityType: "finance",
        entityId: String(rowIndex),
      });
      return JSON.stringify({ ok: true, rowIndex });
    }
    case "update_finance_status": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = Number(row.rowIndex);
      const status = String(row.status).toLowerCase();
      if (!Number.isFinite(rowIndex))
        return JSON.stringify({ error: "invalid rowIndex" });
      const rows = await listFinance();
      const target = rows.find((r) => r.rowIndex === rowIndex);
      if (!target) return JSON.stringify({ error: "row not found" });
      if (status === "paid") {
        setPendingFinancePaid(
          ctx.lineUserId,
          rowIndex,
          `${target.name} | ${target.amount} | due ${target.dueDate}`,
        );
        return JSON.stringify({
          ok: true,
          pendingConfirmation: true,
          instruction:
            "แจ้งผู้ใช้ให้กดปุ่มยืนยัน หรือพิมพ์ ยืนยัน ภายใน 10 นาที",
          row: target,
        });
      }
      await updateFinanceCell(rowIndex, "status", "unpaid");
      invalidateUserCache();
      return JSON.stringify({ ok: true, rowIndex, status: "unpaid" });
    }
    case "list_documents": {
      const st = (row.status as string | undefined)?.toLowerCase() ?? "all";
      let docs = await listDocuments();
      if (st === "open")
        docs = docs.filter(
          (d) => d.status !== "completed" && d.status !== "rejected",
        );
      else if (st !== "all")
        docs = docs.filter((d) => d.status === st);
      return safeJson(docs);
    }
    case "create_document": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = await appendDocument({
        name: String(row.name ?? "").trim(),
        documentType: String(row.documentType ?? "").trim(),
        owner: String(row.owner ?? "").trim(),
        dueDate: String(row.dueDate ?? "").trim(),
        status: String(row.status ?? "missing"),
      });
      invalidateUserCache();
      await logActivity({
        actor: ctx.user?.name ?? ctx.lineUserId,
        action: "document_created",
        entityType: "document",
        entityId: String(rowIndex),
      });
      return JSON.stringify({ ok: true, rowIndex });
    }
    case "update_document_status": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = Number(row.rowIndex);
      if (!Number.isFinite(rowIndex))
        return JSON.stringify({ error: "invalid rowIndex" });
      const docs = await listDocuments();
      if (!docs.some((d) => d.rowIndex === rowIndex))
        return JSON.stringify({ error: "row not found" });
      if (typeof row.status === "string") {
        const s = row.status.toLowerCase();
        if ((DOCUMENT_STATUSES as readonly string[]).includes(s)) {
          await updateDocumentCell(rowIndex, "status", s);
        }
      }
      if (typeof row.owner === "string" && row.owner.trim()) {
        await updateDocumentCell(rowIndex, "owner", row.owner.trim());
      }
      if (typeof row.dueDate === "string" && row.dueDate.trim()) {
        await updateDocumentCell(rowIndex, "dueDate", row.dueDate.trim());
      }
      invalidateUserCache();
      return JSON.stringify({ ok: true, rowIndex });
    }
    case "list_meetings": {
      return safeJson(await listMeetings());
    }
    case "create_meeting": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const title = String(row.title ?? "").trim();
      const datetime = String(row.datetime ?? "").trim();
      if (!title || !datetime)
        return JSON.stringify({ error: "title and datetime required" });

      const resolved = await resolveMeetingParticipants({
        participantMode: row.participantMode as string | undefined,
        participants: row.participants as string | undefined,
        mentionLineUserIds: ctx.lineMentions?.lineUserIds,
        mentionAll: ctx.lineMentions?.mentionAll,
      });
      if (!resolved.names.length) {
        return JSON.stringify({
          error: "no participants resolved",
          warnings: resolved.warnings,
          hint: "ใช้ participantMode=all_active, ระบุชื่อคั่นด้วย comma, หรือ @mention ใน LINE",
        });
      }

      const participants = resolved.names.join(", ");
      const endDt =
        typeof row.endDatetime === "string" ? row.endDatetime.trim() : "";
      const notes = typeof row.notes === "string" ? row.notes.trim() : "";
      const newRow = await appendMeeting(title, datetime, participants, {
        notes,
        endDatetime: endDt,
      });

      const allWarnings = [...resolved.warnings];
      let calendarPayload: Record<string, unknown> | undefined;

      if (newRow > 0 && isGoogleCalendarConfigured()) {
        const { calendar, warnings: calWarnings } = await attachMeetingCalendar(
          newRow,
          {
            title,
            datetime,
            endDatetime: endDt || undefined,
            participantNames: resolved.names,
            notes,
          },
        );
        allWarnings.push(...calWarnings);
        if (calendar) {
          calendarPayload = {
            eventId: calendar.eventId,
            htmlLink: calendar.htmlLink,
            invitedEmails: calendar.invitedEmails,
          };
        }
      }

      invalidateUserCache();
      await logActivity({
        actor: ctx.user?.name ?? ctx.lineUserId,
        action: "meeting_created",
        entityType: "meeting",
        entityId: String(newRow),
        details: `${title} | ${resolved.names.length} participants`,
      });
      return JSON.stringify({
        ok: true,
        rowIndex: newRow,
        participants,
        participantCount: resolved.names.length,
        warnings: allWarnings,
        calendar: calendarPayload,
      });
    }
    case "update_meeting": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = Number(row.rowIndex);
      if (!Number.isFinite(rowIndex))
        return JSON.stringify({ error: "invalid rowIndex" });
      const meetings = await listMeetings();
      if (!meetings.some((m) => m.rowIndex === rowIndex))
        return JSON.stringify({ error: "row not found" });
      if (typeof row.title === "string" && row.title.trim()) {
        await updateMeetingCell(rowIndex, "title", row.title.trim());
      }
      if (typeof row.datetime === "string" && row.datetime.trim()) {
        await updateMeetingCell(rowIndex, "datetime", row.datetime.trim());
      }
      if (
        row.participantMode === "all_active" ||
        (typeof row.participants === "string" && row.participants.trim())
      ) {
        const resolved = await resolveMeetingParticipants({
          participantMode: row.participantMode as string | undefined,
          participants: row.participants as string | undefined,
          mentionLineUserIds: ctx.lineMentions?.lineUserIds,
          mentionAll: ctx.lineMentions?.mentionAll,
        });
        if (resolved.names.length) {
          await updateMeetingCell(
            rowIndex,
            "participants",
            resolved.names.join(", "),
          );
        }
      }
      if (typeof row.rsvp === "string") {
        await updateMeetingCell(rowIndex, "rsvp", row.rsvp.trim());
      }
      if (typeof row.notes === "string") {
        await updateMeetingCell(rowIndex, "notes", row.notes.trim());
      }
      if (typeof row.endDatetime === "string" && row.endDatetime.trim()) {
        await updateMeetingCell(rowIndex, "endDatetime", row.endDatetime.trim());
      }

      const allWarnings: string[] = [];
      let calendarPayload: Record<string, unknown> | undefined;

      if (isGoogleCalendarConfigured()) {
        const fresh = (await listMeetings()).find((m) => m.rowIndex === rowIndex);
        if (fresh) {
          const names =
            row.participantMode === "all_active" ||
            (typeof row.participants === "string" && row.participants.trim())
              ? (
                  await resolveMeetingParticipants({
                    participantMode: row.participantMode as string | undefined,
                    participants: row.participants as string | undefined,
                    mentionLineUserIds: ctx.lineMentions?.lineUserIds,
                    mentionAll: ctx.lineMentions?.mentionAll,
                  })
                ).names
              : fresh.participants
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);

          const { calendar, warnings: calWarnings } =
            await attachMeetingCalendar(rowIndex, {
              title:
                typeof row.title === "string" && row.title.trim()
                  ? row.title.trim()
                  : fresh.title,
              datetime:
                typeof row.datetime === "string" && row.datetime.trim()
                  ? row.datetime.trim()
                  : fresh.datetime,
              endDatetime:
                typeof row.endDatetime === "string" && row.endDatetime.trim()
                  ? row.endDatetime.trim()
                  : fresh.endDatetime || undefined,
              participantNames: names,
              notes:
                typeof row.notes === "string"
                  ? row.notes.trim()
                  : fresh.notes,
              calendarEventId: fresh.calendarEventId || undefined,
            });
          allWarnings.push(...calWarnings);
          if (calendar) {
            calendarPayload = {
              eventId: calendar.eventId,
              htmlLink: calendar.htmlLink,
              invitedEmails: calendar.invitedEmails,
            };
          }
        }
      }

      invalidateUserCache();
      return JSON.stringify({
        ok: true,
        rowIndex,
        warnings: allWarnings,
        calendar: calendarPayload,
      });
    }
    case "list_tasks": {
      const assignee = (row.assignee as string | undefined)?.trim();
      const st = (row.status as string | undefined)?.toLowerCase() ?? "all";
      let tasks = await listTasks();
      if (assignee)
        tasks = tasks.filter(
          (t) => t.assignee.toLowerCase() === assignee.toLowerCase(),
        );
      if (st !== "all") tasks = tasks.filter((t) => t.status === st);
      return safeJson(tasks);
    }
    case "create_task": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = await appendTask({
        title: String(row.title ?? "").trim(),
        assignee: String(row.assignee ?? "").trim(),
        dueDate: String(row.dueDate ?? "").trim(),
        sourceType: String(row.sourceType ?? "").trim(),
        sourceId: String(row.sourceId ?? "").trim(),
      });
      return JSON.stringify({ ok: true, rowIndex });
    }
    case "update_task": {
      const deny = requireWrite(ctx);
      if (deny) return deny;
      const rowIndex = Number(row.rowIndex);
      if (!Number.isFinite(rowIndex))
        return JSON.stringify({ error: "invalid rowIndex" });
      if (typeof row.status === "string") {
        const s = row.status.toLowerCase();
        if ((TASK_STATUSES as readonly string[]).includes(s)) {
          await updateTaskCell(rowIndex, "status", s);
        }
      }
      if (typeof row.assignee === "string" && row.assignee.trim()) {
        await updateTaskCell(rowIndex, "assignee", row.assignee.trim());
      }
      return JSON.stringify({ ok: true, rowIndex });
    }
    case "list_activity_logs": {
      const limit = Math.min(Number(row.limit) || 20, 50);
      const logs = await listActivityLogs(limit);
      if (!isAdmin(ctx.user)) {
        return safeJson(
          logs.map((l) => ({
            timestamp: l.timestamp,
            action: l.action,
            entityType: l.entityType,
          })),
        );
      }
      return safeJson(logs);
    }
    case "notify_user": {
      if (!isAdmin(ctx.user)) {
        return JSON.stringify({ error: "only admin can notify other users" });
      }
      const to = String(row.lineUserId ?? "").trim();
      const message = String(row.message ?? "").trim();
      if (!to || !message) return JSON.stringify({ error: "missing fields" });
      await pushText(to, message);
      return JSON.stringify({ ok: true, pushed: true });
    }
    case "complete_my_profile": {
      if (!ctx.user?.rowIndex) {
        return JSON.stringify({ error: "user not linked in sheet" });
      }
      const name = String(row.name ?? "").trim();
      if (!name) return JSON.stringify({ error: "name is required" });
      const rowIndex = ctx.user.rowIndex;
      await updateUserCell(rowIndex, "name", name);
      if (typeof row.email === "string" && row.email.trim()) {
        await updateUserCell(rowIndex, "email", row.email.trim());
      }
      if (typeof row.department === "string" && row.department.trim()) {
        await updateUserCell(rowIndex, "department", row.department.trim());
      }
      invalidateUserCache();
      await logActivity({
        actor: name,
        action: "profile_completed",
        entityType: "user",
        entityId: String(rowIndex),
      });
      return JSON.stringify({ ok: true, rowIndex, name });
    }
    case "list_users": {
      const users = await listUsers();
      if (isAdmin(ctx.user)) return safeJson(users);
      return safeJson(
        users.map((u) => ({
          name: u.name,
          email: u.email,
          role: u.role,
          department: u.department,
          active: u.active,
          lineUserId: u.lineUserId ? "***" : "",
        })),
      );
    }
    case "update_user": {
      const rowIndex = Number(row.rowIndex);
      if (!Number.isFinite(rowIndex))
        return JSON.stringify({ error: "invalid rowIndex" });
      const users = await listUsers();
      const target = users.find((u) => u.rowIndex === rowIndex);
      if (!target) return JSON.stringify({ error: "row not found" });
      const self = ctx.user?.rowIndex === rowIndex;
      if (!isAdmin(ctx.user) && !self) {
        return JSON.stringify({ error: "admin required to update other users" });
      }
      if (!isAdmin(ctx.user) && (row.role || row.active || row.manager)) {
        return JSON.stringify({ error: "admin required for role/active/manager" });
      }
      if (typeof row.name === "string" && row.name.trim()) {
        await updateUserCell(rowIndex, "name", row.name.trim());
      }
      if (typeof row.email === "string") {
        await updateUserCell(rowIndex, "email", row.email.trim());
      }
      if (isAdmin(ctx.user)) {
        if (typeof row.role === "string" && row.role.trim()) {
          await updateUserCell(rowIndex, "role", row.role.trim().toLowerCase());
        }
        if (typeof row.department === "string") {
          await updateUserCell(rowIndex, "department", row.department.trim());
        }
        if (typeof row.manager === "string") {
          await updateUserCell(rowIndex, "manager", row.manager.trim());
        }
        if (typeof row.active === "string") {
          await updateUserCell(rowIndex, "active", row.active);
        }
      }
      invalidateUserCache();
      return JSON.stringify({ ok: true, rowIndex });
    }
    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}

export async function applyConfirmedFinancePaid(
  lineUserId: string,
): Promise<{ ok: boolean; message: string }> {
  const p = getPending(lineUserId);
  if (!p || p.kind !== "finance_paid") {
    return { ok: false, message: "ไม่มีรายการรอยืนยัน" };
  }
  await updateFinanceCell(p.rowIndex, "status", "paid");
  clearPending(lineUserId);
  invalidateUserCache();
  return {
    ok: true,
    message: `อัปเดตสถานะเป็นจ่ายแล้ว (${p.summary})`,
  };
}
