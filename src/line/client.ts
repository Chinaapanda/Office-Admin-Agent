import { messagingApi } from "@line/bot-sdk";
import { config } from "../config.js";

const { MessagingApiClient } = messagingApi;

let client: InstanceType<typeof MessagingApiClient> | null = null;

export function getLineClient(): InstanceType<typeof MessagingApiClient> {
  if (!client) {
    client = new MessagingApiClient({
      channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN,
    });
  }
  return client;
}

export async function replyText(
  replyToken: string,
  text: string,
): Promise<void> {
  const c = getLineClient();
  await c.replyMessage({
    replyToken,
    messages: [{ type: "text", text }],
  });
}

export async function replyWithQuickConfirm(
  replyToken: string,
  text: string,
): Promise<void> {
  const c = getLineClient();
  await c.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text,
      },
      {
        type: "text",
        text: "กดปุ่มด้านล่างเพื่อยืนยัน หรือพิมพ์คำว่า ยืนยัน",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "ยืนยัน",
                text: "ยืนยัน",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "ยกเลิก",
                text: "ยกเลิก",
              },
            },
          ],
        },
      },
    ],
  });
}

export async function pushText(lineUserId: string, text: string): Promise<void> {
  const c = getLineClient();
  await c.pushMessage({
    to: lineUserId,
    messages: [{ type: "text", text }],
  });
}
