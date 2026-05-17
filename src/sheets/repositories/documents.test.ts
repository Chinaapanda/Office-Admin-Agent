import { describe, expect, it } from "vitest";
import { isDocumentOpen } from "./documents.js";

describe("isDocumentOpen", () => {
  it("marks completed and rejected as closed", () => {
    expect(isDocumentOpen("completed")).toBe(false);
    expect(isDocumentOpen("rejected")).toBe(false);
    expect(isDocumentOpen("received")).toBe(false);
  });
  it("marks workflow states as open", () => {
    expect(isDocumentOpen("missing")).toBe(true);
    expect(isDocumentOpen("requested")).toBe(true);
    expect(isDocumentOpen("reviewed")).toBe(true);
  });
});
