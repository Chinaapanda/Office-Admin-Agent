import { validateSignature } from "@line/bot-sdk";
import { config } from "../config.js";
import { replyText } from "./client.js";
import { handleLineTextMessage } from "../agent/handleMessage.js";
import { registerLineUserOnFollow } from "../sheets/repositories/users.js";
import { logActivity } from "../audit/logActivity.js";
import { parseLineMentions } from "./mentions.js";

type LineWebhookBody = {
  events: Array<{
    type: string;
    replyToken?: string;
    source?: { userId?: string };
    message?: {
      type: string;
      text?: string;
      mention?: {
        mentionees?: Array<{ type?: string; userId?: string }>;
      };
    };
  }>;
};

export async function handleLineWebhook(
  rawBody: Buffer,
  signature: string | undefined,
): Promise<{ status: number; body: string }> {
  if (!signature) {
    return { status: 401, body: "missing signature" };
  }
  const ok = validateSignature(
    rawBody,
    config.LINE_CHANNEL_SECRET,
    signature,
  );
  if (!ok) {
    return { status: 401, body: "invalid signature" };
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody.toString("utf8")) as LineWebhookBody;
  } catch {
    return { status: 400, body: "invalid json" };
  }

  const events = body.events ?? [];
  console.log("[line:webhook]", events.map((e) => e.type).join(", ") || "(no events)");

  for (const ev of events) {
    try {
      await handleLineEvent(ev);
    } catch (err) {
      console.error("[line:webhook] event failed", ev.type, err);
      if (ev.replyToken) {
        try {
          await replyText(
            ev.replyToken,
            "ขออภัยค่ะ ระบบเชื่อม Google Sheets ไม่ได้ชั่วคราว ตรวจไฟล์ credentials.json และสิทธิ์แชร์ Sheet แล้วลองใหม่นะคะ",
          );
        } catch (replyErr) {
          console.error("[line:webhook] could not send error reply", replyErr);
        }
      }
    }
  }

  return { status: 200, body: "ok" };
}

async function handleLineEvent(
  ev: LineWebhookBody["events"][number],
): Promise<void> {
  if (ev.type === "follow" && ev.replyToken && ev.source?.userId) {
    const uid = ev.source.userId;
    const reg = await registerLineUserOnFollow(uid);
    if (reg.created) {
      await logActivity({
        actor: uid,
        action: "user_registered",
        entityType: "user",
        entityId: String(reg.rowIndex ?? ""),
      });
      await replyText(
        ev.replyToken,
        `ยินดีต้อนรับค่ะ — ลงทะเบียนในระบบแล้ว\n\nบอกชื่อ-นามสกุล อีเมล (ถ้ามี) และแผนกในแชทได้เลย ไคโดว์จะบันทึกให้ค่ะ\nพิมพ์ /help เพื่อดูคำสั่ง`,
      );
    } else {
      await replyText(
        ev.replyToken,
        `ยินดีต้อนรับกลับค่ะ\nLINE ID: ${uid}\n\nพิมพ์ /help หรือถามงานได้เลยค่ะ`,
      );
    }
    return;
  }

  if (ev.type === "message" && ev.message?.type === "text") {
    const text = ev.message.text ?? "";
    const replyToken = ev.replyToken;
    const lineUserId = ev.source?.userId;
    if (!replyToken || !lineUserId) return;
    const lineMentions = parseLineMentions(ev.message);
    if (lineMentions.lineUserIds.length || lineMentions.mentionAll) {
      console.log("[line:webhook] mentions", lineMentions);
    }
    await handleLineTextMessage({ lineUserId, replyToken, text, lineMentions });
    return;
  }

  if (
    ev.type === "message" &&
    ev.message?.type === "image" &&
    ev.replyToken
  ) {
    await replyText(
      ev.replyToken,
      "รับไฟล์แล้วค่ะ — การอัปโหลดใบเสร็จ/OCR จะเปิดใช้ในเฟสถัดไป ตอนนี้รบกวนแจ้งรายละเอียดเป็นข้อความหรือส่งให้แอดมินค่ะ",
    );
  }
}
