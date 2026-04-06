import { describe, it, expect } from "vitest";
import { calculateCompletion } from "@/lib/utils/completion";

describe("calculateCompletion", () => {
  it("returns 100 when no critical items exist", () => {
    expect(calculateCompletion([])).toBe(100);
  });

  it("returns 0 when no critical items are resolved", () => {
    const items = [
      { is_critical: true, status: "pending" },
      { is_critical: true, status: "in_progress" },
    ];
    expect(calculateCompletion(items)).toBe(0);
  });

  it("counts complete, skipped, and not_applicable as resolved", () => {
    const items = [
      { is_critical: true, status: "complete" },
      { is_critical: true, status: "skipped" },
      { is_critical: true, status: "not_applicable" },
      { is_critical: true, status: "pending" },
    ];
    expect(calculateCompletion(items)).toBe(75);
  });

  it("ignores non-critical items", () => {
    const items = [
      { is_critical: true, status: "complete" },
      { is_critical: false, status: "pending" },
      { is_critical: false, status: "pending" },
    ];
    expect(calculateCompletion(items)).toBe(100);
  });

  it("rounds down to nearest integer", () => {
    const items = [
      { is_critical: true, status: "complete" },
      { is_critical: true, status: "pending" },
      { is_critical: true, status: "pending" },
    ];
    expect(calculateCompletion(items)).toBe(33);
  });
});
