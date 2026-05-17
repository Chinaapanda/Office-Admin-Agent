import { describe, expect, it } from "vitest";
import {
  isAllParticipantsKeyword,
  splitParticipantNames,
} from "./meetingParticipants.js";

describe("isAllParticipantsKeyword", () => {
  it("matches Thai all-participant phrases", () => {
    expect(isAllParticipantsKeyword("ทุกคน")).toBe(true);
    expect(isAllParticipantsKeyword("คนเข้าประชุมทั้งหมด")).toBe(true);
    expect(isAllParticipantsKeyword("ทุกคนในระบบ")).toBe(true);
  });

  it("does not match explicit names", () => {
    expect(isAllParticipantsKeyword("กิตติกรณ์, สมชาย")).toBe(false);
  });
});

describe("splitParticipantNames", () => {
  it("splits comma-separated names", () => {
    expect(splitParticipantNames("A, B, C")).toEqual(["A", "B", "C"]);
  });
});
