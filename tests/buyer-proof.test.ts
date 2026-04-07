/**
 * Buyer proof/document workflow tests.
 *
 * Verifies:
 *   - Buyer can mark items complete
 *   - Completion percentage recalculates correctly after marking items
 *   - Home status advances (activated → engaged → completed)
 *   - Buyer can upload proof files
 *   - Storage path follows correct convention
 *   - Activity log records are created
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockUpload = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
      })),
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markItemComplete, uploadProofFile } from "@/lib/actions/buyer-items";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockAuth(userId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId } } });
}

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

interface MarkCompleteSetup {
  itemType?: string;
  allItems?: Array<{ is_critical: boolean; status: string }>;
  handoffStatus?: string;
  builderId?: string;
  homeUpdateError?: any;
}

function setupMarkComplete({
  itemType = "checklist",
  allItems = [{ is_critical: true, status: "complete" }],
  handoffStatus = "activated",
  builderId = "builder-1",
  homeUpdateError = null,
}: MarkCompleteSetup = {}) {
  // Track calls
  const homeUpdateFn = vi.fn().mockReturnThis();
  const itemUpdateFn = vi.fn().mockReturnThis();
  const activityInsertFn = vi.fn().mockReturnThis();

  const assignmentChain = createChain({
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
  });

  const itemSelectChain = createChain({
    single: vi.fn().mockResolvedValue({ data: { type: itemType }, error: null }),
  });

  const itemUpdateChain = createChain();
  itemUpdateChain.update = itemUpdateFn;

  // All items — uses thenable pattern
  const allItemsChain = createChain();
  allItemsChain.then = (resolve: any) =>
    resolve({ data: allItems, error: null });

  const homeSelectChain = createChain({
    single: vi.fn().mockResolvedValue({
      data: { handoff_status: handoffStatus, builder_id: builderId },
      error: null,
    }),
  });

  const homeUpdateChain = createChain();
  homeUpdateChain.update = homeUpdateFn;
  homeUpdateChain.then = (resolve: any) =>
    resolve({ data: null, error: homeUpdateError });

  const activityChain = createChain();
  activityChain.insert = activityInsertFn;

  let homeItemCalls = 0;
  let homeCalls = 0;

  mockFrom.mockImplementation((table: string) => {
    if (table === "home_assignments") return assignmentChain;
    if (table === "home_items") {
      homeItemCalls++;
      if (homeItemCalls === 1) return itemSelectChain;
      if (homeItemCalls === 2) return itemUpdateChain;
      return allItemsChain;
    }
    if (table === "homes") {
      homeCalls++;
      if (homeCalls === 1) return homeSelectChain;
      return homeUpdateChain;
    }
    if (table === "activity_log") return activityChain;
    return createChain();
  });

  return { homeUpdateFn, itemUpdateFn, activityInsertFn };
}

// ---------------------------------------------------------------------------
// Tests: markItemComplete — completion & status transitions
// ---------------------------------------------------------------------------

describe("markItemComplete — completion recalculation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("advances home to 'completed' when all critical items are done", async () => {
    mockAuth("buyer-1");

    const { homeUpdateFn } = setupMarkComplete({
      allItems: [
        { is_critical: true, status: "complete" },
        { is_critical: true, status: "complete" },
      ],
      handoffStatus: "activated",
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    expect(homeUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_pct: 100,
        handoff_status: "completed",
      })
    );
  });

  it("advances home to 'engaged' when first item completed from activated state", async () => {
    mockAuth("buyer-1");

    const { homeUpdateFn } = setupMarkComplete({
      allItems: [
        { is_critical: true, status: "complete" },
        { is_critical: true, status: "pending" },
      ],
      handoffStatus: "activated",
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    expect(homeUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_pct: 50,
        handoff_status: "engaged",
      })
    );
  });

  it("does not change handoff_status if already 'engaged' and not 100%", async () => {
    mockAuth("buyer-1");

    const { homeUpdateFn } = setupMarkComplete({
      allItems: [
        { is_critical: true, status: "complete" },
        { is_critical: true, status: "complete" },
        { is_critical: true, status: "pending" },
      ],
      handoffStatus: "engaged",
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    // completion_pct = 66 (2/3)
    expect(homeUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_pct: 66,
      })
    );
    // handoff_status should NOT be in the update since it's already engaged and not 100%
    const updateArg = homeUpdateFn.mock.calls[0][0];
    expect(updateArg.handoff_status).toBeUndefined();
  });

  it("calculates 100% completion when no critical items exist", async () => {
    mockAuth("buyer-1");

    const { homeUpdateFn } = setupMarkComplete({
      allItems: [
        { is_critical: false, status: "pending" },
      ],
      handoffStatus: "activated",
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    expect(homeUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        completion_pct: 100,
        handoff_status: "completed",
      })
    );
  });

  it("logs activity with correct metadata", async () => {
    mockAuth("buyer-1");

    const { activityInsertFn } = setupMarkComplete({
      itemType: "warranty",
    });

    await markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");

    expect(activityInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        builder_id: "builder-1",
        home_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        home_item_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        actor_type: "user",
        actor_id: "buyer-1",
        action: "item_completed",
        metadata: { item_type: "warranty" },
      })
    );
  });

  it("throws when item update fails", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const itemSelectChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { type: "checklist" }, error: null }),
    });
    const itemUpdateChain = createChain();
    itemUpdateChain.then = (resolve: any) =>
      resolve({ error: { message: "update failed" } });

    let homeItemCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "home_items") {
        homeItemCalls++;
        if (homeItemCalls === 1) return itemSelectChain;
        return itemUpdateChain;
      }
      return createChain();
    });

    await expect(markItemComplete("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22")).rejects.toThrow(
      "Failed to update item"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: uploadProofFile — file handling
// ---------------------------------------------------------------------------

describe("uploadProofFile — file upload workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
  });

  it("uploads file and creates file record with correct fields", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const homeChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { builder_id: "builder-1" }, error: null }),
    });

    const insertFn = vi.fn().mockReturnThis();
    const fileRecordChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { id: "file-1" }, error: null }),
    });
    fileRecordChain.insert = insertFn;
    fileRecordChain.select = vi.fn().mockReturnValue(fileRecordChain);

    const itemUpdateChain = createChain();
    const activityChain = createChain();

    let filesCalls = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "homes") return homeChain;
      if (table === "files") {
        filesCalls++;
        return fileRecordChain;
      }
      if (table === "home_items") return itemUpdateChain;
      if (table === "activity_log") return activityChain;
      return createChain();
    });

    const file = new File(["proof content"], "receipt.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("file", file);

    await uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData);

    // Verify file was uploaded to storage
    expect(mockUpload).toHaveBeenCalledOnce();
    const uploadPath = mockUpload.mock.calls[0][0];
    expect(uploadPath).toContain("builder-1");
    expect(uploadPath).toContain("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11");
    expect(uploadPath).toContain("b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22");
    expect(uploadPath).toContain("receipt.jpg");

    // Verify file record was inserted
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        builder_id: "builder-1",
        home_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        home_item_id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
        uploaded_by: "buyer-1",
        filename: "receipt.jpg",
        mime_type: "image/jpeg",
      })
    );
  });

  it("throws when storage upload fails", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const homeChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { builder_id: "builder-1" }, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "homes") return homeChain;
      return createChain();
    });

    mockUpload.mockResolvedValue({ error: { message: "storage full" } });

    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.set("file", file);

    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "Failed to upload file"
    );
  });

  it("throws when file record insert fails", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const homeChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { builder_id: "builder-1" }, error: null }),
    });
    const fileRecordChain = createChain({
      single: vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } }),
    });
    fileRecordChain.select = vi.fn().mockReturnValue(fileRecordChain);

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "homes") return homeChain;
      if (table === "files") return fileRecordChain;
      return createChain();
    });

    mockUpload.mockResolvedValue({ error: null });

    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.set("file", file);

    await expect(uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData)).rejects.toThrow(
      "Failed to save file record"
    );
  });

  it("logs activity after successful upload", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const homeChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { builder_id: "builder-1" }, error: null }),
    });
    const fileRecordChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { id: "file-1" }, error: null }),
    });
    fileRecordChain.select = vi.fn().mockReturnValue(fileRecordChain);

    const itemUpdateChain = createChain();
    const activityInsertFn = vi.fn().mockReturnThis();
    const activityChain = createChain();
    activityChain.insert = activityInsertFn;

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "homes") return homeChain;
      if (table === "files") return fileRecordChain;
      if (table === "home_items") return itemUpdateChain;
      if (table === "activity_log") return activityChain;
      return createChain();
    });

    mockUpload.mockResolvedValue({ error: null });

    const file = new File(["data"], "proof.png", { type: "image/png" });
    const formData = new FormData();
    formData.set("file", file);

    await uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData);

    expect(activityInsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "proof_uploaded",
        metadata: { filename: "proof.png" },
      })
    );
  });

  it("links proof file to home_item after insert", async () => {
    mockAuth("buyer-1");

    const assignmentChain = createChain({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "assign-1" } }),
    });
    const homeChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { builder_id: "builder-1" }, error: null }),
    });
    const fileRecordChain = createChain({
      single: vi.fn().mockResolvedValue({ data: { id: "file-99" }, error: null }),
    });
    fileRecordChain.select = vi.fn().mockReturnValue(fileRecordChain);

    const itemUpdateFn = vi.fn().mockReturnThis();
    const itemUpdateChain = createChain();
    itemUpdateChain.update = itemUpdateFn;

    const activityChain = createChain();

    mockFrom.mockImplementation((table: string) => {
      if (table === "home_assignments") return assignmentChain;
      if (table === "homes") return homeChain;
      if (table === "files") return fileRecordChain;
      if (table === "home_items") return itemUpdateChain;
      if (table === "activity_log") return activityChain;
      return createChain();
    });

    mockUpload.mockResolvedValue({ error: null });

    const file = new File(["data"], "proof.png", { type: "image/png" });
    const formData = new FormData();
    formData.set("file", file);

    await uploadProofFile("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", formData);

    expect(itemUpdateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        proof_file_id: "file-99",
      })
    );
  });
});
