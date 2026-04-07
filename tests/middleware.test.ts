/**
 * Middleware auth protection tests.
 *
 * Verifies that the Next.js middleware correctly gates:
 *   - Builder routes (/dashboard, /settings, /projects, /templates, /homes)
 *   - Buyer routes (/home/*)
 *   - Public routes remain accessible
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so use vi.hoisted for shared refs
// ---------------------------------------------------------------------------

const { mockGetUser, mockRedirect, mockNext } = vi.hoisted(() => {
  const mockGetUser = vi.fn();
  const mockRedirect = vi.fn();
  const mockNext = vi.fn(() => ({ cookies: { set: vi.fn() } }));
  return { mockGetUser, mockRedirect, mockNext };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: mockNext,
    redirect: mockRedirect,
  },
}));

import { middleware } from "../middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(pathname: string) {
  return {
    nextUrl: {
      pathname,
      clone() {
        return { pathname: "", searchParams: new URLSearchParams() };
      },
      searchParams: new URLSearchParams(),
    },
    cookies: {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    },
  } as any;
}

function mockAuthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
}

function mockUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Middleware auth protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockReturnValue({ cookies: { set: vi.fn() } });
  });

  // --- Builder routes ---

  const builderRoutes = ["/dashboard", "/settings", "/projects", "/templates", "/homes"];

  for (const route of builderRoutes) {
    it(`redirects unauthenticated users from ${route} to /login`, async () => {
      mockUnauthenticated();
      const req = makeRequest(route);
      const clonedUrl = { pathname: "", searchParams: new URLSearchParams() };
      req.nextUrl.clone = vi.fn(() => clonedUrl);

      await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(clonedUrl.pathname).toBe("/login");
    });

    it(`allows authenticated users to access ${route}`, async () => {
      mockAuthenticated();
      const req = makeRequest(route);

      const result = await middleware(req);

      expect(mockRedirect).not.toHaveBeenCalled();
    });
  }

  // --- Buyer routes ---

  it("redirects unauthenticated users from /home/{id} to /login with redirect param", async () => {
    mockUnauthenticated();
    const req = makeRequest("/home/abc-123");
    const clonedUrl = { pathname: "", searchParams: new URLSearchParams() };
    req.nextUrl.clone = vi.fn(() => clonedUrl);

    await middleware(req);

    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/login");
    expect(clonedUrl.searchParams.get("redirect")).toBe("/home/abc-123");
  });

  it("allows authenticated users to access /home/{id}", async () => {
    mockAuthenticated();
    const req = makeRequest("/home/abc-123");

    await middleware(req);

    expect(mockRedirect).not.toHaveBeenCalled();
  });

  // --- Public routes ---

  const publicRoutes = ["/login", "/signup", "/accept-invite", "/reset-password"];

  for (const route of publicRoutes) {
    it(`does not block public route ${route}`, async () => {
      mockUnauthenticated();
      const req = makeRequest(route);

      await middleware(req);

      expect(mockRedirect).not.toHaveBeenCalled();
    });
  }

  // --- Builder sub-routes ---

  it("protects builder sub-routes like /dashboard/analytics", async () => {
    mockUnauthenticated();
    const req = makeRequest("/dashboard/analytics");
    const clonedUrl = { pathname: "", searchParams: new URLSearchParams() };
    req.nextUrl.clone = vi.fn(() => clonedUrl);

    await middleware(req);

    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.pathname).toBe("/login");
  });

  it("protects /homes sub-routes like /homes/home-1/edit", async () => {
    mockUnauthenticated();
    const req = makeRequest("/homes/home-1/edit");
    const clonedUrl = { pathname: "", searchParams: new URLSearchParams() };
    req.nextUrl.clone = vi.fn(() => clonedUrl);

    await middleware(req);

    expect(mockRedirect).toHaveBeenCalled();
  });

  // --- Buyer redirect preserves path ---

  it("preserves nested buyer path in redirect param", async () => {
    mockUnauthenticated();
    const req = makeRequest("/home/abc-123/items/item-1");
    const clonedUrl = { pathname: "", searchParams: new URLSearchParams() };
    req.nextUrl.clone = vi.fn(() => clonedUrl);

    await middleware(req);

    expect(mockRedirect).toHaveBeenCalled();
    expect(clonedUrl.searchParams.get("redirect")).toBe("/home/abc-123/items/item-1");
  });
});
