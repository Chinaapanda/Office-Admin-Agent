import { describe, expect, it } from "vitest";
import { parseMeetingTimeWindow } from "./parseMeetingTime.js";

describe("parseMeetingTimeWindow", () => {
  it("parses ISO datetime with default 1h end", () => {
    const r = parseMeetingTimeWindow(
      "2026-05-15T13:00:00",
      undefined,
      "Asia/Bangkok",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.window.startDateTime).toContain("2026-05-15");
    expect(r.window.endDateTime).toContain("2026-05-15");
  });

  it("parses date with time range", () => {
    const r = parseMeetingTimeWindow(
      "2026-05-15 13:00-14:00",
      undefined,
      "Asia/Bangkok",
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.window.startDateTime).toMatch(/13:00:00$/);
    expect(r.window.endDateTime).toMatch(/14:00:00$/);
  });
});
