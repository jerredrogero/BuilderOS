/**
 * Buyer routing and access control tests.
 *
 * Verifies that:
 *   - Buyers can only access homes they are assigned to
 *   - Buyer actions enforce home_assignment checks
 *   - Builders cannot use buyer actions on unrelated homes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({ error: null }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: mockStorage,
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markItemComplete, uploadProofFile } from "@/lib/actions/buyer-items";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createChain(overrides: Partial<Record<string, any>> = {}) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    ...overrides,
  };
  return chain;
}

function mockAuth(userId: string | null) {
  mockGetUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });
}

// ---------------------------------------------------------------------------
// markItemComplete
// ---------------------------------------------------------------------------

describe("markItemComplete — access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 'Not authenticated' when user is not logged in", async () => {
    mockAuth(null);

    await expect(markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22")).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("throws 'Access denied' when user has no assignment for the home", async () => {
    mockAuth("user-no-access");

    // home_assignments query returns null (no assignment)
    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      return createChain();
    });

    await expect(markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22")).rejects.toThrow(
      "Access denied"
    );
  });

  it("throws 'Item not found' when item does not exist or is on a different home", async () => {
    mockAuth("user-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const itemChain = createChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "home_items") return itemChain;
      return createChain();
    });

    await expect(markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a99")).rejects.toThrow(
      "Item not found"
    );
  });

  it("succeeds when user has valid assignment and item exists", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });

    // Item lookup
    const itemSelectChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { type: "checklist" }, error: null }),
    });

    // Item update
    const itemUpdateChain = createChain();

    // All items for completion calc
    const allItemsChain = createChain();
    allItemsChain.then = (resolve: any) =>
      resolve({ data: [{ is_critical: true, status: "complete" }], error: null });

    // Home lookup
    const homeSelectChain = createChain({
      single: vi.fn().mockResolvedValue({
        data: { handoff_status: "activated", builder_id: "builder-1" },
        error: null,
      }),
    });

    // Home update
    const homeUpdateChain = createChain();

    // Activity log
    const activityChain = createChain();

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "home_items" && fromCallIndex === 0) {
        fromCallIndex++;
        return itemSelectChain;
      }
      if (table === "home_items" && fromCallIndex === 1) {
        fromCallIndex++;
        return itemUpdateChain;
      }
      if (table === "home_items") {
        return allItemsChain;
      }
      if (table === "homes" && fromCallIndex <= 3) {
        fromCallIndex++;
        return homeSelectChain;
      }
      if (table === "homes") return homeUpdateChain;
      if (table === "activity_log") return activityChain;
      return createChain();
    });

    await expect(markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22")).resolves.not.toThrow();
  });

  it("sets registration_status for warranty items", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });

    // Item lookup — type: warranty
    const itemSelectChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { type: "warranty" }, error: null }),
    });

    // Track what gets passed to update
    const updateFn = vi.fn().mockReturnThis();
    const itemUpdateChain = createChain();
    itemUpdateChain.update = updateFn;

    const allItemsChain = createChain();
    allItemsChain.then = (resolve: any) =>
      resolve({ data: [{ is_critical: true, status: "complete" }], error: null });

    const homeSelectChain = createChain({
      single: vi.fn().mockResolvedValue({
        data: { handoff_status: "activated", builder_id: "builder-1" },
        error: null,
      }),
    });
    const homeUpdateChain = createChain();
    const activityChain = createChain();

    let homeItemCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "home_items") {
        homeItemCalls++;
        if (homeItemCalls === 1) return itemSelectChain;
        if (homeItemCalls === 2) return itemUpdateChain;
        return allItemsChain;
      }
      if (table === "homes") {
        // first call is select, second is update
        return homeSelectChain;
      }
      if (table === "activity_log") return activityChain;
      return createChain();
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "complete",
        registration_status: "registered",
      })
    );
  });
});

// ---------------------------------------------------------------------------
// uploadProofFile — access control
// ---------------------------------------------------------------------------

describe("uploadProofFile — access control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 'Not authenticated' when user is not logged in", async () => {
    mockAuth(null);

    const formData = new FormData();
    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "Not authenticated"
    );
  });

  it("throws 'Access denied' when user has no assignment", async () => {
    mockAuth("intruder");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      return createChain();
    });

    const formData = new FormData();
    formData.set("file", new File(["test"], "proof.jpg", { type: "image/jpeg" }));

    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "Access denied"
    );
  });

  it("throws 'No file provided' when form has no file", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      return createChain();
    });

    const formData = new FormData();

    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "No file provided"
    );
  });

  it("throws when file exceeds 25MB", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      return createChain();
    });

    // Create a file that reports as > 25MB
    const bigFile = new File(["x"], "big.zip", { type: "application/zip" });
    Object.defineProperty(bigFile, "size", { value: 26 * 1024 * 1024 });

    const formData = new FormData();
    formData.set("file", bigFile);

    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "File too large"
    );
  });
});

// ---------------------------------------------------------------------------
// Buyer cannot access builder routes (documented contract)
// ---------------------------------------------------------------------------

describe("Route protection contract", () => {
  it("builder routes are distinct from buyer routes", () => {
    const builderPrefixes = ["/dashboard", "/settings", "/projects", "/templates", "/homes"];
    const buyerPrefix = "/home/";

    // No builder prefix matches buyer prefix pattern
    for (const bp of builderPrefixes) {
      expect(buyerPrefix.startsWith(bp)).toBe(false);
    }

    // /homes (builder) vs /home/ (buyer) are distinct
    expect("/homes".startsWith("/home/")).toBe(false);
    expect("/home/abc".startsWith("/homes")).toBe(false);
  });
});
