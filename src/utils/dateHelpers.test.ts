import { describe, expect, it } from "vitest";
import { daysBetween, startOfDay } from "./dateHelpers.js";

describe("daysBetween", () => {
  it("counts calendar days", () => {
    const a = startOfDay(new Date("2026-05-10"));
    const b = startOfDay(new Date("2026-05-07"));
    expect(daysBetween(a, b)).toBe(3);
  });
});
