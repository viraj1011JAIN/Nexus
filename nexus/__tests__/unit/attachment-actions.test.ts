/**
 * Unit Tests: Attachment Actions (actions/attachment-actions.ts)
 *
 * Verifies attachment retrieval and deletion with org-boundary security.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockAttachmentFindMany = jest.fn();
const mockAttachmentFindFirst = jest.fn();
const mockAttachmentDelete = jest.fn();

jest.mock("@/lib/db", () => ({
  db: {
    attachment: {
      findMany: (...args: unknown[]) => mockAttachmentFindMany(...args),
      findFirst: (...args: unknown[]) => mockAttachmentFindFirst(...args),
      delete: (...args: unknown[]) => mockAttachmentDelete(...args),
    },
  },
}));

const mockCtx = {
  userId: "user_123",
  orgId: "org_abc",
  orgRole: "org:admin",
  membership: { role: "ADMIN" as const, isActive: true },
};

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue(mockCtx),
  requireRole: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// ─── Import After Mocks ───────────────────────────────────────────────────────

import {
  getCardAttachments,
  deleteAttachment,
  type AttachmentDto,
} from "@/actions/attachment-actions";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const baseDate = new Date("2025-06-01T12:00:00Z");

function makeAttachmentRow(overrides = {}) {
  return {
    id: "att_1",
    fileName: "design.png",
    fileSize: 204800,
    mimeType: "image/png",
    url: "https://storage.example.com/card-attachments/att_1/design.png",
    storagePath: "att_1/design.png",
    cardId: "card_xyz",
    uploadedById: "user_123",
    uploadedByName: "Alice",
    createdAt: baseDate,
    ...overrides,
  };
}

function makeAttachmentWithRelations(overrides = {}) {
  return {
    ...makeAttachmentRow(overrides),
    card: {
      list: {
        board: { id: "board_1", orgId: mockCtx.orgId },
      },
    },
  };
}

// ─── Tests: getCardAttachments ────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getCardAttachments", () => {
  it("returns AttachmentDto array for a card", async () => {
    mockAttachmentFindMany.mockResolvedValue([makeAttachmentRow()]);

    const result = await getCardAttachments("card_xyz");

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);

    const dto = result.data![0] as AttachmentDto;
    expect(dto.id).toBe("att_1");
    expect(dto.fileName).toBe("design.png");
    expect(dto.fileSize).toBe(204800);
    expect(dto.mimeType).toBe("image/png");
    expect(dto.uploadedByName).toBe("Alice");
    expect(dto.createdAt).toEqual(baseDate);
  });

  it("returns empty array when card has no attachments", async () => {
    mockAttachmentFindMany.mockResolvedValue([]);
    const result = await getCardAttachments("card_no_attachments");
    expect(result.data).toHaveLength(0);
  });

  it("queries by correct cardId", async () => {
    mockAttachmentFindMany.mockResolvedValue([]);
    await getCardAttachments("card_xyz");
    expect(mockAttachmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cardId: "card_xyz" } })
    );
  });

  it("orders results by createdAt desc (newest first)", async () => {
    mockAttachmentFindMany.mockResolvedValue([makeAttachmentRow()]);
    await getCardAttachments("card_xyz");
    const callArg = mockAttachmentFindMany.mock.calls[0][0];
    expect(callArg.orderBy).toEqual({ createdAt: "desc" });
  });

  it("does NOT expose storagePath or uploadedById in the DTO", async () => {
    mockAttachmentFindMany.mockResolvedValue([makeAttachmentRow()]);
    const result = await getCardAttachments("card_xyz");
    const dto = result.data![0] as AttachmentDto & Record<string, unknown>;
    expect(dto.storagePath).toBeUndefined();
    expect(dto.uploadedById).toBeUndefined();
  });

  it("returns all attachments when a card has multiple files", async () => {
    mockAttachmentFindMany.mockResolvedValue([
      makeAttachmentRow({ id: "att_1", fileName: "a.png" }),
      makeAttachmentRow({ id: "att_2", fileName: "b.pdf" }),
      makeAttachmentRow({ id: "att_3", fileName: "c.doc" }),
    ]);
    const result = await getCardAttachments("card_xyz");
    expect(result.data).toHaveLength(3);
  });
});

// ─── Tests: deleteAttachment ──────────────────────────────────────────────────

describe("deleteAttachment", () => {
  it("deletes and returns empty object on success", async () => {
    mockAttachmentFindFirst.mockResolvedValue(makeAttachmentWithRelations());
    mockAttachmentDelete.mockResolvedValue({});

    const result = await deleteAttachment("att_1", "board_1");

    expect(result.error).toBeUndefined();
    expect(mockAttachmentDelete).toHaveBeenCalledWith({ where: { id: "att_1" } });
  });

  it("returns error when attachment does not exist", async () => {
    mockAttachmentFindFirst.mockResolvedValue(null);

    const result = await deleteAttachment("att_missing", "board_1");

    expect(result.error).toBe("Attachment not found");
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });

  it("returns Forbidden when attachment belongs to different org", async () => {
    mockAttachmentFindFirst.mockResolvedValue({
      ...makeAttachmentRow(),
      card: { list: { board: { id: "board_2", orgId: "org_other" } } },
    });

    const result = await deleteAttachment("att_1", "board_2");

    expect(result.error).toBe("Forbidden");
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });

  it("fetches attachment with board relation for org check", async () => {
    mockAttachmentFindFirst.mockResolvedValue(makeAttachmentWithRelations());
    mockAttachmentDelete.mockResolvedValue({});

    await deleteAttachment("att_1", "board_1");

    const callArg = mockAttachmentFindFirst.mock.calls[0][0];
    expect(callArg.where.id).toBe("att_1");
    expect(callArg.include?.card?.include?.list?.include?.board).toBeTruthy();
  });

  it("revalidates board path after deletion", async () => {
    const { revalidatePath } = await import("next/cache");
    mockAttachmentFindFirst.mockResolvedValue(makeAttachmentWithRelations());
    mockAttachmentDelete.mockResolvedValue({});

    await deleteAttachment("att_1", "board_1");

    expect(revalidatePath).toHaveBeenCalledWith("/board/board_1");
  });

  it("never deletes attachment for a different org even with matching attachmentId", async () => {
    // Simulate an attachment that exists but belongs to a rival org
    mockAttachmentFindFirst.mockResolvedValue({
      ...makeAttachmentRow(),
      card: { list: { board: { id: "board_evil", orgId: "org_evil" } } },
    });

    const result = await deleteAttachment("att_1", "board_evil");

    expect(result.error).toBe("Forbidden");
    expect(mockAttachmentDelete).not.toHaveBeenCalled();
  });
});
