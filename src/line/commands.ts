import { listFinance } from "../sheets/repositories/finance.js";
import { listDocuments, isDocumentOpen } from "../sheets/repositories/documents.js";
import { listMeetings } from "../sheets/repositories/meetings.js";
import { listTasks } from "../sheets/repositories/tasks.js";
import type { UserRow } from "../sheets/schemas.js";

const HELP_TEXT = `คำสั่งที่ใช้ได้:
/help — แสดงความช่วยเหลือ
/status — สรุปงานค้างของคุณ
/pending — รายการค้างจ่ายและเอกสาร
/paid — ดูรายการค้างชำระ (ใช้แชทธรรมชาติเพื่อบันทึกจ่ายแล้ว)

หรือพิมพ์คำถามภาษาไทย/อังกฤษได้ตามปกติค่ะ`;

export type CommandResult =
  | { handled: true; text: string; needsConfirmQuickReply?: boolean }
  | { handled: false };

export async function tryLineCommand(
  text: string,
  user: UserRow,
): Promise<CommandResult> {
  const cmd = text.trim().toLowerCase().split(/\s+/)[0];

  if (cmd === "/help" || cmd === "help") {
    return { handled: true, text: HELP_TEXT };
  }

  if (cmd === "/status") {
    const name = user.name.trim();
    const finance = await listFinance();
    const unpaid = finance.filter(
      (r) =>
        r.status === "unpaid" &&
        (r.responsible.trim() === name || r.name.trim() === name),
    );
    const docs = await listDocuments();
    const openDocs = docs.filter(
      (d) =>
        isDocumentOpen(d.status) &&
        (d.owner.trim() === name || d.assignedTo.trim() === name),
    );
    const tasks = await listTasks();
    const myTasks = tasks.filter(
      (t) =>
        t.assignee.trim() === name &&
        t.status !== "completed" &&
        t.status !== "failed",
    );
    return {
      handled: true,
      text: `สรุปสถานะ — ${name}

ค้างชำระ: ${unpaid.length} รายการ
เอกสารค้าง: ${openDocs.length} รายการ
งานที่มอบหมาย: ${myTasks.length} รายการ`,
    };
  }

  if (cmd === "/pending" || cmd === "/paid") {
    const name = user.name.trim();
    const finance = await listFinance();
    const unpaid = finance.filter(
      (r) =>
        r.status === "unpaid" &&
        (r.responsible.trim() === name || r.name.trim() === name),
    );
    const lines =
      unpaid.length > 0
        ? unpaid.map((r) => `• ${r.name}: ${r.amount} (ครบ ${r.dueDate})`)
        : ["(ไม่มีรายการค้างชำระ)"];
    return {
      handled: true,
      text: `รายการค้างชำระ:\n${lines.join("\n")}\n\nบอกชื่อรายการเพื่ออัปเดตว่าจ่ายแล้วได้ค่ะ`,
    };
  }

  if (cmd === "/meetings") {
    const meetings = await listMeetings();
    const upcoming = meetings
      .filter((m) => Date.parse(m.datetime) > Date.now())
      .slice(0, 5);
    const lines =
      upcoming.length > 0
        ? upcoming.map((m) => `• ${m.title} — ${m.datetime}`)
        : ["(ไม่มีการประชุมที่กำลังจะมาถึง)"];
    return { handled: true, text: `การประชุมที่ใกล้ถึง:\n${lines.join("\n")}` };
  }

  if (text.trim() === "รับทราบ" || text.trim() === "ไม่สะดวก") {
    return {
      handled: true,
      text: "บันทึกการตอบรับแล้วค่ะ (อัปเดต RSVP ใน Sheet ผ่านแอดมินหรือแชทได้)",
    };
  }

  return { handled: false };
}
