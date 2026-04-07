/**
 * Home-items validation tests.
 *
 * Verifies that the Zod schemas in home-items.ts correctly validate
 * and reject inputs for all mutation paths: updateHomeItemStatus,
 * updateHomeItem, and deleteHomeItem.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();

function buildChain(terminal: () => any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockImplementation(() => terminal());
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
      return buildChain(() => ({ data: null, error: null }));
    }),
  })),
}));

vi.mock("@/lib/queries/builders", () => ({
  getCurrentBuilder: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/completion", () => ({
  calculateCompletion: vi.fn(() => 50),
}));

import {
  updateHomeItemStatus,
  updateHomeItem,
  deleteHomeItem,
} from "@/lib/actions/home-items";
import { getCurrentBuilder } from "@/lib/queries/builders";

const mockedGetCurrentBuilder = vi.mocked(getCurrentBuilder);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setAuth(role = "owner", builderId = "builder-1") {
  mockedGetCurrentBuilder.mockResolvedValue({
    role,
    builder: { id: builderId },
    userId: "user-1",
  } as any);
}

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const VALID_UUID_2 = "660e8400-e29b-41d4-a716-446655440000";

function setupItemExists(type = "checklist") {
  fromBehaviors = {
    home_items: () => ({ data: { type }, error: null }),
    homes: () => ({ data: null, error: null }),
    activity_log: () => ({ data: null, error: null }),
  };
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.set(k, v);
  }
  return fd;
}

// ---------------------------------------------------------------------------
// Tests — updateHomeItemStatus
// ---------------------------------------------------------------------------

describe("updateHomeItemStatus validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromBehaviors = {};
  });

  it("rejects invalid UUID for homeId", async () => {
    await expect(
      updateHomeItemStatus("not-a-uuid", VALID_UUID, "pending")
    ).rejects.toThrow();
  });

  it("rejects invalid UUID for itemId", async () => {
    await expect(
      updateHomeItemStatus(VALID_UUID, "not-a-uuid", "pending")
    ).rejects.toThrow();
  });

  it("rejects invalid status value", async () => {
    await expect(
      updateHomeItemStatus(VALID_UUID, VALID_UUID_2, "bogus_status")
    ).rejects.toThrow(/Status must be one of/);
  });

  it("rejects empty status", async () => {
    await expect(
      updateHomeItemStatus(VALID_UUID, VALID_UUID_2, "")
    ).rejects.toThrow();
  });

  for (const status of [
    "pending",
    "in_progress",
    "complete",
    "skipped",
    "not_applicable",
  ]) {
    it(`accepts valid status "${status}" with valid UUIDs`, async () => {
      setAuth();
      setupItemExists();
      await expect(
        updateHomeItemStatus(VALID_UUID, VALID_UUID_2, status)
      ).resolves.not.toThrow();
    });
  }

  it("throws Unauthorized when not authenticated", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null as any);
    // Validation passes, then auth check fails
    await expect(
      updateHomeItemStatus(VALID_UUID, VALID_UUID_2, "pending")
    ).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Tests — updateHomeItem
// ---------------------------------------------------------------------------

describe("updateHomeItem validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromBehaviors = {};
  });

  it("rejects invalid UUID for homeId", async () => {
    const fd = makeFormData({
      type: "checklist",
      title: "Test",
      category: "General",
    });
    await expect(
      updateHomeItem("not-a-uuid", VALID_UUID, fd)
    ).rejects.toThrow();
  });

  it("rejects invalid UUID for itemId", async () => {
    const fd = makeFormData({
      type: "checklist",
      title: "Test",
      category: "General",
    });
    await expect(
      updateHomeItem(VALID_UUID, "not-a-uuid", fd)
    ).rejects.toThrow();
  });

  it("rejects invalid item type", async () => {
    setAuth();
    setupItemExists();
    const fd = makeFormData({
      type: "invalid_type",
      title: "Test",
      category: "General",
    });
    await expect(
      updateHomeItem(VALID_UUID, VALID_UUID_2, fd)
    ).rejects.toThrow(/Type must be one of/);
  });

  it("rejects empty title", async () => {
    setAuth();
    setupItemExists();
    const fd = makeFormData({
      type: "checklist",
      title: "",
      category: "General",
    });
    await expect(
      updateHomeItem(VALID_UUID, VALID_UUID_2, fd)
    ).rejects.toThrow(/Title is required/);
  });

  it("rejects empty category", async () => {
    setAuth();
    setupItemExists();
    const fd = makeFormData({
      type: "checklist",
      title: "Test Item",
      category: "",
    });
    await expect(
      updateHomeItem(VALID_UUID, VALID_UUID_2, fd)
    ).rejects.toThrow(/Category is required/);
  });

  it("accepts all valid item types", async () => {
    const validTypes = [
      "checklist",
      "document",
      "warranty",
      "utility",
      "info",
      "punch_list",
    ];
    for (const type of validTypes) {
      setAuth();
      setupItemExists(type);
      const fd = makeFormData({
        type,
        title: "Test",
        category: "General",
      });
      await expect(
        updateHomeItem(VALID_UUID, VALID_UUID_2, fd)
      ).resolves.not.toThrow();
    }
  });

  it("throws Unauthorized for non-owner role", async () => {
    mockedGetCurrentBuilder.mockResolvedValue({
      role: "staff",
      builder: { id: "builder-1" },
    } as any);
    setupItemExists();
    const fd = makeFormData({
      type: "checklist",
      title: "Test",
      category: "General",
    });
    await expect(
      updateHomeItem(VALID_UUID, VALID_UUID_2, fd)
    ).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Tests — deleteHomeItem
// ---------------------------------------------------------------------------

describe("deleteHomeItem validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromBehaviors = {};
  });

  it("rejects invalid UUID for homeId", async () => {
    await expect(deleteHomeItem("not-a-uuid", VALID_UUID)).rejects.toThrow();
  });

  it("rejects invalid UUID for itemId", async () => {
    await expect(deleteHomeItem(VALID_UUID, "not-a-uuid")).rejects.toThrow();
  });

  it("succeeds with valid UUIDs and owner role", async () => {
    setAuth();
    setupItemExists();
    await expect(
      deleteHomeItem(VALID_UUID, VALID_UUID_2)
    ).resolves.not.toThrow();
  });

  it("throws Unauthorized for non-owner role", async () => {
    mockedGetCurrentBuilder.mockResolvedValue({
      role: "viewer",
      builder: { id: "builder-1" },
    } as any);
    await expect(
      deleteHomeItem(VALID_UUID, VALID_UUID_2)
    ).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when not authenticated", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null as any);
    await expect(
      deleteHomeItem(VALID_UUID, VALID_UUID_2)
    ).rejects.toThrow("Unauthorized");
  });
});
