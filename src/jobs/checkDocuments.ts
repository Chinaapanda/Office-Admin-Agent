import {
  isDocumentOpen,
  listDocuments,
  updateDocumentCell,
} from "../sheets/repositories/documents.js";
import { pushText } from "../line/client.js";
import { cronDocumentRequestText } from "../messaging/persona.js";
import { resolveLineUserIdByName } from "../utils/resolveUser.js";
import { logActivity } from "../audit/logActivity.js";

export async function runDocumentReminders(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const docs = await listDocuments();

  for (const row of docs) {
    if (!isDocumentOpen(row.status)) continue;
    const ownerName = row.owner.trim() || row.assignedTo.trim();
    if (!ownerName) continue;

    const lineUserId = await resolveLineUserIdByName(ownerName);
    if (!lineUserId) {
      console.warn(
        `Document row ${row.rowIndex}: no lineUserId for owner "${ownerName}"`,
      );
      continue;
    }

    const last = row.lastRequestAt?.trim();
    if (last === today) continue;

    const text = cronDocumentRequestText({
      ownerName,
      docName: row.name,
      docType: row.documentType,
      dueDate: row.dueDate,
    });
    await pushText(lineUserId, text);
    await updateDocumentCell(row.rowIndex, "lastRequestAt", today);
    if (row.status === "missing") {
      await updateDocumentCell(row.rowIndex, "status", "requested");
    }
    await logActivity({
      actor: "cron:documents",
      action: "document_requested",
      entityType: "document",
      entityId: String(row.rowIndex),
      details: row.name,
    });
  }
}
