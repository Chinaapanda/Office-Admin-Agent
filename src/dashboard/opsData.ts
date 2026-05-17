import { listFinance } from "../sheets/repositories/finance.js";
import { listDocuments, isDocumentOpen } from "../sheets/repositories/documents.js";
import { listMeetings } from "../sheets/repositories/meetings.js";
import { listTasks } from "../sheets/repositories/tasks.js";
import { listActivityLogs } from "../sheets/repositories/activity.js";

export type OpsSnapshot = {
  unpaidCount: number;
  unpaidTotal: number;
  openDocuments: number;
  meetingsToday: number;
  pendingTasks: number;
  recentActivity: Array<{
    timestamp: string;
    action: string;
    entityType: string;
    details: string;
  }>;
};

export async function loadOpsSnapshot(): Promise<OpsSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const finance = await listFinance();
  const unpaid = finance.filter((r) => r.status === "unpaid");
  let unpaidTotal = 0;
  for (const r of unpaid) {
    const n = parseFloat(String(r.amount).replace(/,/g, ""));
    if (!Number.isNaN(n)) unpaidTotal += n;
  }

  const docs = await listDocuments();
  const openDocuments = docs.filter((d) => isDocumentOpen(d.status)).length;

  const meetings = await listMeetings();
  const meetingsToday = meetings.filter((m) =>
    m.datetime.startsWith(today),
  ).length;

  const tasks = await listTasks();
  const pendingTasks = tasks.filter(
    (t) => t.status === "pending" || t.status === "waiting",
  ).length;

  const logs = await listActivityLogs(10);

  return {
    unpaidCount: unpaid.length,
    unpaidTotal,
    openDocuments,
    meetingsToday,
    pendingTasks,
    recentActivity: logs.map((l) => ({
      timestamp: l.timestamp,
      action: l.action,
      entityType: l.entityType,
      details: l.details,
    })),
  };
}

export function renderOpsDashboardHtml(data: OpsSnapshot): string {
  const activityRows = data.recentActivity
    .map(
      (a) =>
        `<tr><td>${escapeHtml(a.timestamp)}</td><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.entityType)}</td><td>${escapeHtml(a.details)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Office Admin — Operations</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #0f1419; color: #e7e9ea; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .card { background: #1a2332; border-radius: 12px; padding: 1rem; border: 1px solid #2f3b4a; }
    .card strong { display: block; font-size: 1.75rem; color: #1d9bf0; }
    .card span { font-size: 0.8rem; color: #8b98a5; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #2f3b4a; }
    th { color: #8b98a5; }
  </style>
</head>
<body>
  <h1>ไคโดว์ — Operations Dashboard</h1>
  <div class="grid">
    <div class="card"><strong>${data.unpaidCount}</strong><span>รายการค้างจ่าย</span></div>
    <div class="card"><strong>${data.unpaidTotal.toLocaleString()}</strong><span>ยอดค้าง (บาท)</span></div>
    <div class="card"><strong>${data.openDocuments}</strong><span>เอกสารค้าง</span></div>
    <div class="card"><strong>${data.meetingsToday}</strong><span>ประชุมวันนี้</span></div>
    <div class="card"><strong>${data.pendingTasks}</strong><span>งานรอดำเนินการ</span></div>
  </div>
  <h2>Activity (ล่าสุด)</h2>
  <table>
    <thead><tr><th>เวลา</th><th>การกระทำ</th><th>ประเภท</th><th>รายละเอียด</th></tr></thead>
    <tbody>${activityRows || "<tr><td colspan=4>ไม่มีข้อมูล</td></tr>"}</tbody>
  </table>
  <p style="margin-top:2rem;font-size:0.75rem;color:#8b98a5">Refresh เพื่ออัปเดต · ข้อมูลจาก Google Sheets</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
