import { describe, it, expect } from "vitest";
import { rankItems } from "@/lib/utils/priority";

describe("rankItems", () => {
  const today = new Date("2026-04-06");

  it("puts overdue items first, sorted by most overdue", () => {
    const items = [
      { id: "a", due_date: "2026-04-04", is_critical: true, status: "pending" },
      { id: "b", due_date: "2026-04-01", is_critical: true, status: "pending" },
      { id: "c", due_date: "2026-04-10", is_critical: true, status: "pending" },
    ];
    const ranked = rankItems(items, today);
    expect(ranked.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("ranks critical above non-critical at equal urgency", () => {
    const items = [
      { id: "a", due_date: "2026-04-10", is_critical: false, status: "pending" },
      { id: "b", due_date: "2026-04-10", is_critical: true, status: "pending" },
    ];
    const ranked = rankItems(items, today);
    expect(ranked[0].id).toBe("b");
  });

  it("puts items with no due date last", () => {
    const items = [
      { id: "a", due_date: null, is_critical: true, status: "pending" },
      { id: "b", due_date: "2026-04-10", is_critical: false, status: "pending" },
    ];
    const ranked = rankItems(items, today);
    expect(ranked[0].id).toBe("b");
  });

  it("excludes completed items", () => {
    const items = [
      { id: "a", due_date: "2026-04-01", is_critical: true, status: "complete" },
      { id: "b", due_date: "2026-04-10", is_critical: true, status: "pending" },
    ];
    const ranked = rankItems(items, today);
    expect(ranked.length).toBe(1);
    expect(ranked[0].id).toBe("b");
  });
});
