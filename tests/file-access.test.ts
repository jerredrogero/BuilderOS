/**
 * File access API route tests (/api/files/[fileId]).
 *
 * Verifies:
 *   - Auth enforcement (401 for unauthenticated)
 *   - File not found (404)
 *   - Signed URL generation and redirect
 *   - Download vs view mode
 *   - URL generation failure (500)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockStorage = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: mockStorage,
  })),
}));

import { GET } from "@/app/api/files/[fileId]/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(searchParams: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/files/file-1");
  for (const [key, val] of Object.entries(searchParams)) {
    url.searchParams.set(key, val);
  }
  return {
    nextUrl: url,
  } as any;
}

function makeParams(fileId = "file-1") {
  return { params: Promise.resolve({ fileId }) };
}

function mockFileQuery(file: any) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: file }),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

function mockSignedUrl(signedUrl: string | null) {
  mockStorage.from.mockReturnValue({
    createSignedUrl: vi.fn().mockResolvedValue({
      data: signedUrl ? { signedUrl } : null,
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/files/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for unauthenticated request", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 when file is not found", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("File not found");
  });

  it("returns 404 when file is blocked by RLS", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery(null); // RLS returns no data

    const response = await GET(makeRequest(), makeParams("restricted-file"));

    expect(response.status).toBe(404);
  });

  it("redirects to signed URL for authorized file access (view mode)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery({ storage_path: "builder-1/home-1/general/doc.pdf", filename: "doc.pdf" });
    mockSignedUrl("https://storage.example.com/signed-url-view");

    const response = await GET(makeRequest(), makeParams());

    // NextResponse.redirect returns a Response with 307/302 status
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
  });

  it("passes download disposition when ?download=true", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery({ storage_path: "builder-1/home-1/general/doc.pdf", filename: "doc.pdf" });
    mockSignedUrl("https://storage.example.com/signed-url-download");

    await GET(makeRequest({ download: "true" }), makeParams());

    // Verify createSignedUrl was called with download option
    const createSignedUrl = mockStorage.from.mock.results[0].value.createSignedUrl;
    expect(createSignedUrl).toHaveBeenCalledWith(
      "builder-1/home-1/general/doc.pdf",
      3600,
      { download: "doc.pdf" }
    );
  });

  it("does not set download disposition without ?download=true", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery({ storage_path: "builder-1/home-1/general/doc.pdf", filename: "doc.pdf" });
    mockSignedUrl("https://storage.example.com/signed-url-view");

    await GET(makeRequest(), makeParams());

    const createSignedUrl = mockStorage.from.mock.results[0].value.createSignedUrl;
    expect(createSignedUrl).toHaveBeenCalledWith(
      "builder-1/home-1/general/doc.pdf",
      3600,
      { download: undefined }
    );
  });

  it("treats ?download=false as view mode", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery({ storage_path: "path/to/file.pdf", filename: "file.pdf" });
    mockSignedUrl("https://storage.example.com/signed");

    await GET(makeRequest({ download: "false" }), makeParams());

    const createSignedUrl = mockStorage.from.mock.results[0].value.createSignedUrl;
    expect(createSignedUrl).toHaveBeenCalledWith(
      "path/to/file.pdf",
      3600,
      { download: undefined }
    );
  });

  it("returns 500 when signed URL generation fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockFileQuery({ storage_path: "path/to/file.pdf", filename: "file.pdf" });
    mockSignedUrl(null);

    const response = await GET(makeRequest(), makeParams());

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to generate URL");
  });
});
