/**
 * Login redirect flow tests.
 *
 * Tests the root page (/) which acts as a role-aware router:
 *   1. No user → redirect("/login")
 *   2. Builder (owner/staff) → redirect("/dashboard")
 *   3. Buyer with 1 home → redirect("/home/{id}")
 *   4. Buyer with N homes → render chooser (no redirect)
 *   5. No role / no homes → render "no homes" message
 *
 * Note: tests/routing.test.ts already covers this. This file adds edge-case
 * coverage for regressions specifically around login-redirect behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args);
    throw new Error("NEXT_REDIRECT");
  },
}));

const mockGetBuyerHomes = vi.fn();
vi.mock("@/lib/queries/homes", () => ({
  getBuyerHomes: (...args: unknown[]) => mockGetBuyerHomes(...args),
}));

import Home from "@/app/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockUser(id = "user-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id } } });
}

function mockNoUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

function mockBuilderMembership(found: boolean) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: found ? { id: "membership-1" } : null,
    }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Login redirect flow — root page (/)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unauthenticated user redirects to /login", async () => {
    mockNoUser();

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("builder (owner) redirects to /dashboard without checking buyer homes", async () => {
    mockUser("builder-owner");
    mockBuilderMembership(true);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    expect(mockGetBuyerHomes).not.toHaveBeenCalled();
  });

  it("builder (staff) also redirects to /dashboard", async () => {
    mockUser("builder-staff");
    mockBuilderMembership(true);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("buyer with single home redirects to /home/{homeId}", async () => {
    mockUser("buyer-single");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      { home_id: "home-xyz", homes: { address: "100 Elm St", lot_number: null, builders: null } },
    ]);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/home/home-xyz");
  });

  it("buyer with multiple homes renders chooser (no redirect)", async () => {
    mockUser("buyer-multi");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      { home_id: "home-1", homes: { address: "1 Main St", lot_number: "A", builders: { name: "Acme" } } },
      { home_id: "home-2", homes: { address: "2 Oak Ave", lot_number: "B", builders: { name: "Acme" } } },
    ]);

    const result = await Home();
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("user with no role and no homes shows 'no homes assigned'", async () => {
    mockUser("orphan-user");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([]);

    const result = await Home();
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // --- Regression guards ---

  it("never redirects buyer to /dashboard", async () => {
    mockUser("buyer-reg");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      { home_id: "home-q", homes: { address: "Reg Test", lot_number: null, builders: null } },
    ]);

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).not.toHaveBeenCalledWith("/dashboard");
  });

  it("membership check queries with owner and staff roles", async () => {
    mockUser("role-check");
    const chain = mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([]);

    await Home();

    // Verify the .in() call included both owner and staff
    expect(chain.in).toHaveBeenCalledWith("role", ["owner", "staff"]);
  });

  it("getBuyerHomes is called with correct user id", async () => {
    mockUser("specific-user-id");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([]);

    await Home();

    expect(mockGetBuyerHomes).toHaveBeenCalledWith("specific-user-id");
  });
});
