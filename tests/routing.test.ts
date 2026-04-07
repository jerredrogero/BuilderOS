/**
 * Regression tests for post-login routing behavior.
 *
 * The root page (/) acts as a role-aware router after login:
 *   1. No user          → redirect("/login")
 *   2. Builder (owner/staff) → redirect("/dashboard")
 *   3. Buyer with 1 home     → redirect("/home/{id}")
 *   4. Buyer with N homes    → render chooser (no redirect)
 *   5. No role / no homes    → render "no homes" message (no redirect)
 *
 * These tests prevent regressions where buyers silently fall back to the
 * builder dashboard or builders land on the buyer flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

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
    // next/navigation redirect throws to halt execution
    throw new Error("NEXT_REDIRECT");
  },
}));

const mockGetBuyerHomes = vi.fn();
vi.mock("@/lib/queries/homes", () => ({
  getBuyerHomes: (...args: unknown[]) => mockGetBuyerHomes(...args),
}));

// We need to suppress React rendering since this is an async Server Component.
// We call Home() directly as an async function and inspect redirect calls.
import Home from "@/app/page";

// --- Helpers ---

function mockUser(id = "user-1") {
  mockGetUser.mockResolvedValue({ data: { user: { id } } });
}

function mockNoUser() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

/** Simulate the supabase chained query builder for memberships */
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

// --- Tests ---

describe("Post-login routing (root page /)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users to /login", async () => {
    mockNoUser();

    await expect(Home({})).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects builders (owner/staff) to /dashboard", async () => {
    mockUser("builder-1");
    mockBuilderMembership(true);

    await expect(Home({})).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    // Must NOT call getBuyerHomes for builders
    expect(mockGetBuyerHomes).not.toHaveBeenCalled();
  });

  it("redirects a buyer with exactly one home to /home/{id}", async () => {
    mockUser("buyer-1");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      {
        home_id: "home-abc",
        role: "buyer",
        homes: { address: "123 Main St", lot_number: "1", builders: { name: "Acme" } },
      },
    ]);

    await expect(Home({})).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/home/home-abc");
  });

  it("renders a chooser page for buyers with multiple homes (no redirect)", async () => {
    mockUser("buyer-2");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      {
        home_id: "home-1",
        role: "buyer",
        homes: { address: "123 Main St", lot_number: "1", builders: { name: "Acme" } },
      },
      {
        home_id: "home-2",
        role: "buyer",
        homes: { address: "456 Oak Ave", lot_number: "2", builders: { name: "Acme" } },
      },
    ]);

    // Should NOT throw (no redirect), should return JSX
    const result = await Home({});
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders 'no homes assigned' for users with no role", async () => {
    mockUser("unassigned-1");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([]);

    const result = await Home({});
    expect(result).toBeDefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // --- Regression-specific guards ---

  it("buyer routing never falls back to /dashboard", async () => {
    mockUser("buyer-3");
    mockBuilderMembership(false);
    mockGetBuyerHomes.mockResolvedValue([
      { home_id: "home-x", role: "buyer", homes: { address: "789 Elm", lot_number: null, builders: null } },
    ]);

    await expect(Home({})).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).not.toHaveBeenCalledWith("/dashboard");
    expect(mockRedirect).toHaveBeenCalledWith("/home/home-x");
  });

  it("builder routing never falls through to buyer home redirect", async () => {
    mockUser("builder-2");
    mockBuilderMembership(true);

    await expect(Home({})).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledTimes(1);
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
    // getBuyerHomes should not even be called for builders
    expect(mockGetBuyerHomes).not.toHaveBeenCalled();
  });

  it("login page directs to / (not /dashboard) ensuring role router runs", async () => {
    // The login page must call router.push("/") so the root role-router runs.
    // If someone changes login to push("/dashboard") directly, buyers break.
    // We verify this by reading the login page source and checking for the pattern.
    const fs = await import("fs");
    const path = await import("path");
    const loginSource = fs.readFileSync(
      path.resolve(__dirname, "../src/app/(auth)/login/page.tsx"),
      "utf-8"
    );
    // The login page must push to "/" — the root role-aware router
    expect(loginSource).toContain('router.push("/")');
    // It must NOT push directly to /dashboard (bypasses role routing)
    expect(loginSource).not.toContain('router.push("/dashboard")');
  });
});

describe("Middleware auth protection — source contract", () => {
  // Verifies the middleware source protects the expected routes.
  // Full behavioral middleware tests live in tests/middleware.test.ts.
  // These tests catch drift between the middleware source and the expected route list.

  let middlewareSource: string;

  beforeEach(async () => {
    const fs = await import("fs");
    const path = await import("path");
    middlewareSource = fs.readFileSync(
      path.resolve(__dirname, "../middleware.ts"),
      "utf-8"
    );
  });

  const expectedBuilderRoutes = ["/dashboard", "/settings", "/projects", "/templates", "/homes"];

  for (const route of expectedBuilderRoutes) {
    it(`middleware source protects builder route ${route}`, () => {
      expect(middlewareSource).toContain(`pathname.startsWith("${route}")`);
    });
  }

  it("middleware source protects buyer route /home/", () => {
    expect(middlewareSource).toContain('pathname.startsWith("/home/")');
  });

  it("middleware redirects unauthenticated users to /login", () => {
    expect(middlewareSource).toContain('url.pathname = "/login"');
  });

  it("middleware preserves buyer redirect path in searchParams", () => {
    expect(middlewareSource).toContain('searchParams.set("redirect"');
  });
});
