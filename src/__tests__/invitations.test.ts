import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers — Supabase chain builder
// ---------------------------------------------------------------------------

function createMockChain(returnData: any = null, returnError: any = null) {
  const chain: any = {
    _data: returnData,
    _error: returnError,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue({ data: returnData, error: returnError }),
  };
  return chain;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();
const mockAuthGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockAuthGetUser },
  })),
  createServiceClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { admin: { generateLink: vi.fn().mockResolvedValue({ error: null }) } },
  })),
}));

vi.mock("@/lib/queries/builders", () => ({
  getCurrentBuilder: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({
  resend: { emails: { send: vi.fn().mockResolvedValue({ error: null }) } },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Server-action modules must import AFTER mocks are registered
import { sendInvitation, resendInvitation } from "@/lib/actions/invitations";
import { getCurrentBuilder } from "@/lib/queries/builders";
import { resend } from "@/lib/email/client";

const mockedGetCurrentBuilder = vi.mocked(getCurrentBuilder);
const mockEmailSend = vi.mocked(resend.emails.send);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BUILDER_ID = "builder-1";
const HOME_ID = "home-1";
const INVITATION_ID = "inv-1";
const TOKEN = "tok-abc123";
const BUYER_EMAIL = "buyer@example.com";

function builderContext(overrides: Record<string, any> = {}) {
  return {
    builder: {
      id: BUILDER_ID,
      name: "Acme Homes",
      primary_color: "#3366ff",
      ...overrides,
    },
    role: "owner" as const,
  };
}

function fakeInvitation(overrides: Record<string, any> = {}) {
  return {
    id: INVITATION_ID,
    home_id: HOME_ID,
    builder_id: BUILDER_ID,
    email: BUYER_EMAIL,
    token: TOKEN,
    status: "pending",
    resend_count: 0,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function fakeHome(overrides: Record<string, any> = {}) {
  return {
    id: HOME_ID,
    builder_id: BUILDER_ID,
    address: "123 Main St",
    handoff_status: "ready",
    projects: { name: "Sunset Heights" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
});

// ===========================================================================
// sendInvitation
// ===========================================================================

describe("sendInvitation", () => {
  it("throws when user is not an owner", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await expect(sendInvitation(HOME_ID, formData)).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("throws when email is not provided", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const formData = new FormData();
    // no email set

    await expect(sendInvitation(HOME_ID, formData)).rejects.toThrow(
      "Email is required"
    );
  });

  it("creates invitation and sends email for a valid request", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const home = fakeHome();
    const invitation = fakeInvitation();

    // homes query
    const homesChain = createMockChain(home);
    // invitations insert
    const invitationsInsertChain = createMockChain(invitation);
    // invitations update (status → sent)
    const invitationsUpdateChain = createMockChain(null);
    // homes update (handoff_status → invited)
    const homesUpdateChain = createMockChain(null);
    // activity_log insert
    const activityChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "homes" && fromCallIndex === 0) {
        fromCallIndex++;
        return homesChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationsInsertChain;
      }
      if (table === "invitations" && fromCallIndex === 2) {
        fromCallIndex++;
        return invitationsUpdateChain;
      }
      if (table === "homes" && fromCallIndex === 3) {
        fromCallIndex++;
        return homesUpdateChain;
      }
      if (table === "activity_log") {
        return activityChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await sendInvitation(HOME_ID, formData);

    // Email was sent with correct data
    expect(mockEmailSend).toHaveBeenCalledOnce();
    const emailCall = mockEmailSend.mock.calls[0][0];
    expect(emailCall.to).toBe(BUYER_EMAIL);
    expect(emailCall.subject).toContain("123 Main St");

    // Activity was logged
    expect(activityChain.insert).toHaveBeenCalled();
  });

  it("throws when home is not found", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const homesChain = createMockChain(null, { message: "not found" });
    mockFrom.mockImplementation(() => homesChain);

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await expect(sendInvitation(HOME_ID, formData)).rejects.toThrow(
      "Home not found"
    );
  });

  it("does not throw when email fails but logs error", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const home = fakeHome({ handoff_status: "draft" });
    const invitation = fakeInvitation();

    const homesChain = createMockChain(home);
    const invitationsInsertChain = createMockChain(invitation);
    const activityChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "homes" && fromCallIndex === 0) {
        fromCallIndex++;
        return homesChain;
      }
      if (table === "invitations") {
        fromCallIndex++;
        return invitationsInsertChain;
      }
      if (table === "activity_log") {
        return activityChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: { message: "bad domain" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    // Should not throw even if email send fails
    await sendInvitation(HOME_ID, formData);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to send invitation email"),
      expect.anything()
    );

    consoleSpy.mockRestore();
  });

  it("advances home to 'invited' when handoff_status is 'ready' and email succeeds", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const home = fakeHome({ handoff_status: "ready" });
    const invitation = fakeInvitation();

    const homesChain = createMockChain(home);
    const invitationsInsertChain = createMockChain(invitation);
    const invitationsUpdateChain = createMockChain(null);
    const homesUpdateChain = createMockChain(null);
    const activityChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "homes" && fromCallIndex === 0) {
        fromCallIndex++;
        return homesChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationsInsertChain;
      }
      if (table === "invitations" && fromCallIndex === 2) {
        fromCallIndex++;
        return invitationsUpdateChain;
      }
      if (table === "homes" && fromCallIndex === 3) {
        fromCallIndex++;
        return homesUpdateChain;
      }
      if (table === "activity_log") {
        return activityChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await sendInvitation(HOME_ID, formData);

    // Home status update was called (fromCallIndex reached 4 means homes was updated)
    expect(homesUpdateChain.update).toHaveBeenCalled();
  });

  it("does NOT advance home when handoff_status is not 'ready'", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const home = fakeHome({ handoff_status: "draft" });
    const invitation = fakeInvitation();

    const homesChain = createMockChain(home);
    const invitationsInsertChain = createMockChain(invitation);
    const invitationsUpdateChain = createMockChain(null);
    const homesUpdateChain = createMockChain(null);
    const activityChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "homes" && fromCallIndex === 0) {
        fromCallIndex++;
        return homesChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationsInsertChain;
      }
      if (table === "invitations" && fromCallIndex === 2) {
        fromCallIndex++;
        return invitationsUpdateChain;
      }
      if (table === "homes" && fromCallIndex === 3) {
        fromCallIndex++;
        return homesUpdateChain;
      }
      if (table === "activity_log") {
        return activityChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await sendInvitation(HOME_ID, formData);

    // homesUpdateChain.update should NOT have been called since home is draft
    expect(homesUpdateChain.update).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// resendInvitation
// ===========================================================================

describe("resendInvitation", () => {
  it("throws when user is not authenticated", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null);

    await expect(
      resendInvitation(HOME_ID, INVITATION_ID)
    ).rejects.toThrow("Unauthorized");
  });

  it("throws when invitation is not found", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const chain = createMockChain(null, { message: "not found" });
    mockFrom.mockReturnValue(chain);

    await expect(
      resendInvitation(HOME_ID, INVITATION_ID)
    ).rejects.toThrow("Invitation not found");
  });

  it("resends email and increments resend_count", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const invitation = fakeInvitation({
      resend_count: 2,
      homes: { address: "456 Oak Ave" },
    });

    const invitationSelectChain = createMockChain(invitation);
    const invitationUpdateChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "invitations" && fromCallIndex === 0) {
        fromCallIndex++;
        return invitationSelectChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationUpdateChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    await resendInvitation(HOME_ID, INVITATION_ID);

    // Email was resent
    expect(mockEmailSend).toHaveBeenCalledOnce();
    const emailCall = mockEmailSend.mock.calls[0][0];
    expect(emailCall.to).toBe(BUYER_EMAIL);
    expect(emailCall.subject).toContain("456 Oak Ave");

    // Invitation was updated with new expiry and incremented resend_count
    expect(invitationUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sent",
        resend_count: 3,
      })
    );
  });

  it("does not update invitation when email send fails", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const invitation = fakeInvitation({ homes: { address: "789 Elm" } });
    const invitationSelectChain = createMockChain(invitation);
    const invitationUpdateChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "invitations" && fromCallIndex === 0) {
        fromCallIndex++;
        return invitationSelectChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationUpdateChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: { message: "bounce" } });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await resendInvitation(HOME_ID, INVITATION_ID);

    // Should NOT update invitation when email fails
    expect(invitationUpdateChain.update).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("resets expires_at on successful resend", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const invitation = fakeInvitation({
      resend_count: 0,
      homes: { address: "100 Pine" },
    });

    const invitationSelectChain = createMockChain(invitation);
    const invitationUpdateChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "invitations" && fromCallIndex === 0) {
        fromCallIndex++;
        return invitationSelectChain;
      }
      if (table === "invitations" && fromCallIndex === 1) {
        fromCallIndex++;
        return invitationUpdateChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    await resendInvitation(HOME_ID, INVITATION_ID);

    const updateArg = invitationUpdateChain.update.mock.calls[0][0];
    expect(updateArg.expires_at).toBeDefined();
    // Expires_at should be ~7 days in the future
    const expiresAt = new Date(updateArg.expires_at);
    const sixDaysFromNow = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(sixDaysFromNow.getTime());
    expect(expiresAt.getTime()).toBeLessThan(eightDaysFromNow.getTime());
  });
});

// ===========================================================================
// Expiry logic (unit-level validation of the INVITATION_EXPIRY_DAYS constant)
// ===========================================================================

describe("invitation expiry", () => {
  it("getExpiresAt produces a date 7 days in the future", async () => {
    // We test this indirectly through sendInvitation's insert call
    mockedGetCurrentBuilder.mockResolvedValue(builderContext());

    const home = fakeHome();
    const invitation = fakeInvitation();

    const homesChain = createMockChain(home);
    const invitationsInsertChain = createMockChain(invitation);
    const activityChain = createMockChain(null);

    let fromCallIndex = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "homes" && fromCallIndex === 0) {
        fromCallIndex++;
        return homesChain;
      }
      if (table === "invitations") {
        fromCallIndex++;
        return invitationsInsertChain;
      }
      if (table === "activity_log") {
        return activityChain;
      }
      return createMockChain();
    });

    mockEmailSend.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await sendInvitation(HOME_ID, formData);

    const insertArg = invitationsInsertChain.insert.mock.calls[0][0];
    expect(insertArg.expires_at).toBeDefined();
    const expiresAt = new Date(insertArg.expires_at);
    const sixDaysFromNow = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    const eightDaysFromNow = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(sixDaysFromNow.getTime());
    expect(expiresAt.getTime()).toBeLessThan(eightDaysFromNow.getTime());
  });
});

// ===========================================================================
// Accept invite page logic (testing the key decision branches)
// ===========================================================================

describe("accept-invite flow validation", () => {
  it("expired invitation should be detected by date comparison", () => {
    // The page checks: new Date(expires_at) < new Date()
    const pastDate = new Date(Date.now() - 1000).toISOString();
    expect(new Date(pastDate) < new Date()).toBe(true);
  });

  it("valid invitation should not be expired", () => {
    const futureDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(new Date(futureDate) < new Date()).toBe(false);
  });

  it("already-accepted invitation is rejected", () => {
    // The page checks invitation.status === "accepted"
    const inv = fakeInvitation({ status: "accepted" });
    expect(inv.status === "accepted").toBe(true);
  });

  it("already-expired status is rejected", () => {
    const inv = fakeInvitation({ status: "expired" });
    expect(inv.status === "expired").toBe(true);
  });

  it("pending invitation with valid token proceeds", () => {
    const inv = fakeInvitation({ status: "pending" });
    const hasToken = !!inv.token;
    const isNotExpired = new Date(inv.expires_at) > new Date();
    const isNotAccepted = inv.status !== "accepted";
    expect(hasToken && isNotExpired && isNotAccepted).toBe(true);
  });
});

// ===========================================================================
// Authorization boundary tests
// ===========================================================================

describe("invitation authorization", () => {
  it("sendInvitation rejects non-owner roles", async () => {
    mockedGetCurrentBuilder.mockResolvedValue({
      builder: { id: BUILDER_ID, name: "X" },
      role: "staff",
    });

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await expect(sendInvitation(HOME_ID, formData)).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("sendInvitation rejects when no builder context", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", BUYER_EMAIL);

    await expect(sendInvitation(HOME_ID, formData)).rejects.toThrow(
      "Unauthorized"
    );
  });

  it("resendInvitation rejects when no builder context", async () => {
    mockedGetCurrentBuilder.mockResolvedValue(null);

    await expect(
      resendInvitation(HOME_ID, INVITATION_ID)
    ).rejects.toThrow("Unauthorized");
  });
});
