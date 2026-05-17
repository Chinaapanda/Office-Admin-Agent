import OpenAI from "openai";
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { config } from "../config.js";
import { buildSystemPromptForAgent } from "../messaging/persona.js";
import { agentToolDefinitions, executeTool, type ToolContext } from "./tools.js";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return openai;
}

export async function runAgentConversation(
  userText: string,
  ctx: ToolContext,
): Promise<string> {
  const client = getOpenAI();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPromptForAgent(ctx.user) },
    {
      role: "user",
      content: userText,
    },
  ];

  let rounds = 0;
  while (rounds < config.AGENT_MAX_TOOL_ROUNDS) {
    rounds += 1;
    const completion = await client.chat.completions.create({
      model: config.OPENAI_MODEL,
      messages,
      tools: agentToolDefinitions,
      tool_choice: "auto",
    });
    const choice = completion.choices[0]?.message;
    if (!choice) return "ขออภัยค่ะ ระบบไม่สามารถตอบได้ชั่วคราว";

    const assistantMsg: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: choice.tool_calls,
    };
    messages.push(assistantMsg);

    if (!choice.tool_calls?.length) {
      return choice.content?.trim() || "เรียบร้อยค่ะ";
    }

    for (const tc of choice.tool_calls) {
      if (tc.type !== "function") continue;
      const name = tc.function.name;
      let args: unknown = {};
      try {
        args = JSON.parse(tc.function.arguments || "{}") as unknown;
      } catch {
        args = {};
      }
      console.log("[agent] tool call", { round: rounds, name, args });
      const result = await executeTool(name, args, ctx);
      console.log(
        "[agent] tool result",
        name,
        result.slice(0, 200) + (result.length > 200 ? "…" : ""),
      );
      const toolMsg: ChatCompletionToolMessageParam = {
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      };
      messages.push(toolMsg);
    }
  }

  return "ขออภัยค่ะ คำขอซับซ้อนเกินไป ลองแยกคำถามหรือลองใหม่ภายหลังนะคะ";
}
