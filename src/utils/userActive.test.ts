import { describe, expect, it } from "vitest";
import { parseActiveFlag } from "./userActive.js";

describe("parseActiveFlag", () => {
  it("treats empty as active", () => {
    expect(parseActiveFlag("")).toBe(true);
  });
  it("parses yes/no", () => {
    expect(parseActiveFlag("yes")).toBe(true);
    expect(parseActiveFlag("no")).toBe(false);
    expect(parseActiveFlag("inactive")).toBe(false);
  });
});
