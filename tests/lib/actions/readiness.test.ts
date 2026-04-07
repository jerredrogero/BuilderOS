import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();

function buildChain(terminal: () => any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn((..._args: any[]) => {
    // Count eq calls to know when to resolve
    chain._eqCount = (chain._eqCount ?? 0) + 1;
    return chain;
  });
  // Make the chain thenable so await resolves it
  chain.then = (resolve: Function) => resolve(terminal());
  return chain;
}

let fromBehaviors: Record<string, () => any>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: vi.fn((table: string) => {
      if (fromBehaviors[table]) {
        return buildChain(fromBehaviors[table]);
      }
      return buildChain(() => ({ data: null, error: null, count: 0 }));
    }),
  })),
}));

vi.mock("@/lib/queries/builders", () => ({
  getCurrentBuilder: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { updateHomeStatus } from "@/lib/actions/homes";
import { getCurrentBuilder } from "@/lib/queries/builders";

const mockedGetCurrentBuilder = vi.mocked(getCurrentBuilder);

// ── Helpers ────────────────────────────────────────────────────────────────

function setAuth(role = "owner", builderId = "builder-1") {
  mockedGetCurrentBuilder.mockResolvedValue({
    role,
    builder: { id: builderId },
  } as any);
}

function setupReadinessData({
  items = [] as any[],
  docCount = 0,
  updateError = null as any,
}: {
  items?: any[];
  docCount?: number;
  updateError?: any;
} = {}) {
  fromBehaviors = {
    home_items: () => ({ data: items, error: null }),
    files: () => ({ data: null, error: null, count: docCount }),
    homes: () => ({ data: null, error: updateError }),
    activity_log: () => ({ data: null, error: null }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("updateHomeStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromBehaviors = {};
  });

  // ── Auth ──────────────────────────────────────────────────────────────

  describe("authorization", () => {
    it("throws Unauthorized when getCurrentBuilder returns null", async () => {
      mockedGetCurrentBuilder.mockResolvedValue(null as any);
      await expect(updateHomeStatus("home-1", "draft")).rejects.toThrow(
        "Unauthorized"
      );
    });

    it("throws Unauthorized when role is not owner", async () => {
      setAuth("viewer");
      await expect(updateHomeStatus("home-1", "draft")).rejects.toThrow(
        "Unauthorized"
      );
    });
  });

  // ── Zod validation ────────────────────────────────────────────────────

  describe("Zod validation", () => {
    it("rejects an invalid status value", async () => {
      setAuth();
      await expect(updateHomeStatus("home-1", "bogus")).rejects.toThrow(
        "Invalid handoff status"
      );
    });

    it("rejects an empty status", async () => {
      setAuth();
      await expect(updateHomeStatus("home-1", "")).rejects.toThrow();
    });
  });

  // ── Non-ready transitions skip readiness checks ───────────────────────

  describe("non-ready status transitions", () => {
    for (const status of ["draft", "activated", "completed"]) {
      it(`"${status}" skips readiness checks and succeeds`, async () => {
        setAuth();
        setupReadinessData(); // no docs, no items — would fail if checked
        await expect(
          updateHomeStatus("home-1", status)
        ).resolves.not.toThrow();
      });
    }
  });

  // ── Readiness checks for status="ready" ───────────────────────────────

  describe('readiness enforcement (status="ready")', () => {
    it("fails when no documents exist", async () => {
      setAuth();
      setupReadinessData({ items: [], docCount: 0 });
      await expect(updateHomeStatus("home-1", "ready")).rejects.toThrow(
        "At least one document must be uploaded"
      );
    });

    it("fails when a warranty item lacks manufacturer and is not N/A", async () => {
      setAuth();
      setupReadinessData({
        items: [
          { type: "warranty", manufacturer: null, status: "active", metadata: {} },
        ],
        docCount: 1,
      });
      await expect(updateHomeStatus("home-1", "ready")).rejects.toThrow(
        "All warranty items must have a manufacturer or be marked not applicable"
      );
    });

    it("fails when a utility item lacks provider_name and is not N/A", async () => {
      setAuth();
      setupReadinessData({
        items: [
          {
            type: "utility",
            manufacturer: null,
            status: "active",
            metadata: {},
          },
        ],
        docCount: 1,
      });
      await expect(updateHomeStatus("home-1", "ready")).rejects.toThrow(
        "All utility items must have a provider or be marked not applicable"
      );
    });

    it("reports all failures at once when multiple checks fail", async () => {
      setAuth();
      setupReadinessData({
        items: [
          { type: "warranty", manufacturer: null, status: "active", metadata: {} },
          { type: "utility", manufacturer: null, status: "active", metadata: {} },
        ],
        docCount: 0,
      });
      await expect(updateHomeStatus("home-1", "ready")).rejects.toThrow(
        /At least one document.*warranty.*provider/s
      );
    });

    // ── Passing scenarios ──────────────────────────────────────────────

    it("passes when docs exist and all warranty items have manufacturer", async () => {
      setAuth();
      setupReadinessData({
        items: [
          { type: "warranty", manufacturer: "Acme", status: "active", metadata: {} },
        ],
        docCount: 1,
      });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });

    it("passes when warranty item is marked not_applicable", async () => {
      setAuth();
      setupReadinessData({
        items: [
          { type: "warranty", manufacturer: null, status: "not_applicable", metadata: {} },
        ],
        docCount: 1,
      });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });

    it("passes when utility item has provider_name in metadata", async () => {
      setAuth();
      setupReadinessData({
        items: [
          {
            type: "utility",
            manufacturer: null,
            status: "active",
            metadata: { provider_name: "Electric Co" },
          },
        ],
        docCount: 1,
      });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });

    it("passes when utility item is marked not_applicable", async () => {
      setAuth();
      setupReadinessData({
        items: [
          {
            type: "utility",
            manufacturer: null,
            status: "not_applicable",
            metadata: {},
          },
        ],
        docCount: 1,
      });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });

    it("passes with no home items if docs exist", async () => {
      setAuth();
      setupReadinessData({ items: [], docCount: 3 });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });

    it("passes with mixed passing warranty and utility items", async () => {
      setAuth();
      setupReadinessData({
        items: [
          { type: "warranty", manufacturer: "Acme", status: "active", metadata: {} },
          { type: "warranty", manufacturer: null, status: "not_applicable", metadata: {} },
          { type: "utility", manufacturer: null, status: "active", metadata: { provider_name: "Water Co" } },
          { type: "utility", manufacturer: null, status: "not_applicable", metadata: {} },
        ],
        docCount: 2,
      });
      await expect(
        updateHomeStatus("home-1", "ready")
      ).resolves.not.toThrow();
    });
  });

  // ── DB update failure ─────────────────────────────────────────────────

  describe("database update failure", () => {
    it("throws when the homes update returns an error", async () => {
      setAuth();
      setupReadinessData({
        items: [],
        docCount: 1,
        updateError: { message: "db error" },
      });
      await expect(updateHomeStatus("home-1", "ready")).rejects.toThrow(
        "Failed to update home status"
      );
    });
  });
});

// ── UI parity: computeReadinessChecks (pure function, no mocks) ────────

import { computeReadinessChecks } from "@/components/builder/readiness-checklist";

describe("computeReadinessChecks (UI parity)", () => {
  it("all checks fail with no docs and bad items", () => {
    const result = computeReadinessChecks(
      [
        { type: "warranty", manufacturer: null, status: "active", metadata: {} },
        { type: "utility", manufacturer: null, status: "active", metadata: {} },
      ],
      false
    );
    expect(result.allPassed).toBe(false);
    expect(result.checks.every((c: any) => !c.passed)).toBe(true);
  });

  it("all checks pass with docs and valid items", () => {
    const result = computeReadinessChecks(
      [
        { type: "warranty", manufacturer: "Acme", status: "active", metadata: {} },
        { type: "utility", manufacturer: null, status: "active", metadata: { provider_name: "Elec" } },
      ],
      true
    );
    expect(result.allPassed).toBe(true);
    expect(result.checks.every((c: any) => c.passed)).toBe(true);
  });

  it("passes with not_applicable items", () => {
    const result = computeReadinessChecks(
      [
        { type: "warranty", manufacturer: null, status: "not_applicable", metadata: {} },
        { type: "utility", manufacturer: null, status: "not_applicable", metadata: {} },
      ],
      true
    );
    expect(result.allPassed).toBe(true);
  });

  it("passes with empty items and docs", () => {
    const result = computeReadinessChecks([], true);
    expect(result.allPassed).toBe(true);
  });
});
