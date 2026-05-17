import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import { handleLineWebhook } from "./line/webhook.js";
import { loadOpsSnapshot, renderOpsDashboardHtml } from "./dashboard/opsData.js";

const app = new Hono();

app.get("/health", (c) =>
  c.json({ ok: true, service: "kaidow-assistant", version: "0.2.0" }),
);

app.get("/dashboard", async (c) => {
  const token = config.DASHBOARD_TOKEN?.trim();
  if (token) {
    const provided =
      c.req.query("token") ?? c.req.header("x-dashboard-token") ?? "";
    if (provided !== token) {
      return c.text("Unauthorized", 401);
    }
  }
  try {
    const data = await loadOpsSnapshot();
    return c.html(renderOpsDashboardHtml(data));
  } catch (e) {
    console.error("dashboard error", e);
    return c.text("Failed to load dashboard", 500);
  }
});

app.get("/api/ops", async (c) => {
  const token = config.DASHBOARD_TOKEN?.trim();
  if (token) {
    const provided =
      c.req.query("token") ?? c.req.header("x-dashboard-token") ?? "";
    if (provided !== token) {
      return c.json({ error: "unauthorized" }, 401);
    }
  }
  try {
    const data = await loadOpsSnapshot();
    return c.json(data);
  } catch (e) {
    console.error("ops api error", e);
    return c.json({ error: "failed" }, 500);
  }
});

app.post("/webhook/line", async (c) => {
  const buf = Buffer.from(await c.req.arrayBuffer());
  const sig = c.req.header("x-line-signature");
  const { status, body } = await handleLineWebhook(buf, sig);
  return c.text(body, status as 200 | 400 | 401);
});

export function startServer(): ReturnType<typeof serve> {
  return serve(
    {
      fetch: app.fetch,
      port: config.PORT,
    },
    (info) => {
      console.log(`Listening on http://localhost:${info.port}`);
      console.log(`Dashboard: http://localhost:${info.port}/dashboard`);
    },
  );
}
