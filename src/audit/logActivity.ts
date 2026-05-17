import { appendActivityLog } from "../sheets/repositories/activity.js";

export async function logActivity(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: string;
}): Promise<void> {
  try {
    await appendActivityLog({
      actor: params.actor,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? "",
      details: params.details ?? "",
    });
  } catch (e) {
    console.error("[activity]", params.action, e);
  }
}
