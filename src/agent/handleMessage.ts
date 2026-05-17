import {
  findUserByLineId,
  registerLineUserOnFollow,
} from "../sheets/repositories/users.js";
import { replyText, replyWithQuickConfirm } from "../line/client.js";
import { isActiveUser, isRegistered } from "./policy.js";
import { runAgentConversation } from "./llm.js";
import { applyConfirmedFinancePaid } from "./tools.js";
import { tryLineCommand } from "../line/commands.js";
import { clearPending, getPending } from "./confirm.js";
import { logActivity } from "../audit/logActivity.js";
import type { ParsedLineMentions } from "../line/mentions.js";
import { formatLineMentionHint } from "../utils/meetingParticipants.js";

export async function handleLineTextMessage(params: {
  lineUserId: string;
  replyToken: string;
  text: string;
  lineMentions?: ParsedLineMentions;
}): Promise<void> {
  const { lineUserId, replyToken, text, lineMentions } = params;
  const trimmed = text.trim();

  if (trimmed === "ยกเลิก") {
    clearPending(lineUserId);
    await replyText(replyToken, "ยกเลิกรายการรอยืนยันแล้วค่ะ");
    return;
  }

  if (trimmed === "ยืนยัน") {
    const res = await applyConfirmedFinancePaid(lineUserId);
    await replyText(replyToken, res.message);
    if (res.ok) {
      await logActivity({
        actor: lineUserId,
        action: "finance_marked_paid",
        entityType: "finance",
        details: res.message,
      });
    }
    return;
  }

  let user = await findUserByLineId(lineUserId);
  if (!isRegistered(user)) {
    console.log("[agent] auto-register", { lineUserId });
    const reg = await registerLineUserOnFollow(lineUserId);
    if (reg.created) {
      await logActivity({
        actor: lineUserId,
        action: "user_registered",
        entityType: "user",
        entityId: String(reg.rowIndex ?? ""),
        details: "first_message",
      });
    }
    user = await findUserByLineId(lineUserId);
  }
  if (!isRegistered(user)) {
    await replyText(
      replyToken,
      "สวัสดีค่ะ — ยังเชื่อมบัญชีไม่ได้ ตรวจ Google Sheet และสิทธิ์แชร์ให้บอท แล้วลองใหม่นะคะ",
    );
    return;
  }

  if (!isActiveUser(user)) {
    await replyText(
      replyToken,
      "บัญชีของคุณถูกปิดใช้งานชั่วคราว กรุณาติดต่อแอดมินค่ะ",
    );
    return;
  }

  const cmd = await tryLineCommand(trimmed, user!);
  if (cmd.handled) {
    await replyText(replyToken, cmd.text);
    return;
  }

  const pending = getPending(lineUserId);
  if (pending?.kind === "finance_paid") {
    await replyWithQuickConfirm(
      replyToken,
      `มีรายการรอยืนยันจ่ายแล้ว:\n${pending.summary}\n\nกดยืนยันเมื่อพร้อมค่ะ`,
    );
    return;
  }

  try {
    console.log("[agent] message", {
      from: user!.name || lineUserId,
      text: trimmed.slice(0, 80),
    });
    let agentText = trimmed;
    if (lineMentions) {
      const hint = await formatLineMentionHint(lineMentions);
      if (hint) agentText = `${trimmed}\n\n${hint}`;
    }
    const answer = await runAgentConversation(agentText, {
      lineUserId,
      user: user!,
      lineMentions,
    });
    const stillPending = getPending(lineUserId);
    if (stillPending?.kind === "finance_paid") {
      await replyWithQuickConfirm(
        replyToken,
        `${answer}\n\n— รอยืนยัน: ${stillPending.summary}`,
      );
    } else {
      await replyText(replyToken, answer);
    }
    await logActivity({
      actor: user!.name || lineUserId,
      action: "agent_message",
      entityType: "line",
      details: trimmed.slice(0, 120),
    });
  } catch (e) {
    console.error("agent error", e);
    await replyText(
      replyToken,
      "ขออภัยค่ะ เกิดข้อผิดพลาดชั่วคราว ลองใหม่ภายหลังนะคะ",
    );
  }
}
