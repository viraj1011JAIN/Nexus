/**
 * Unit Tests: Template Actions (actions/template-actions.ts)
 *
 * All Prisma calls and tenant context are mocked so these tests
 * run in-process without any DB or Clerk dependency.
 */

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockBoardTemplateFindMany = jest.fn();
const mockBoardTemplateFindFirst = jest.fn();
const mockBoardTemplateCreate = jest.fn();
const mockBoardCreate = jest.fn();
const mockListCreate = jest.fn();
const mockCardCreateMany = jest.fn();
const mockAuditLogCreate = jest.fn();
const mockUserFindFirst = jest.fn().mockResolvedValue({ name: "Test User", imageUrl: null });

jest.mock("@/lib/db", () => ({
  db: {
    boardTemplate: {
      findMany: (...args: unknown[]) => mockBoardTemplateFindMany(...args),
      findFirst: (...args: unknown[]) => mockBoardTemplateFindFirst(...args),
      create: (...args: unknown[]) => mockBoardTemplateCreate(...args),
    },
    board: {
      create: (...args: unknown[]) => mockBoardCreate(...args),
    },
    list: {
      create: (...args: unknown[]) => mockListCreate(...args),
    },
    card: {
      createMany: (...args: unknown[]) => mockCardCreateMany(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
    },
    $transaction: jest.fn().mockImplementation(async (fn) => {
      // run the callback with the same mocked tx object
      const tx = {
        board: { create: (...args: unknown[]) => mockBoardCreate(...args) },
        list: { create: (...args: unknown[]) => mockListCreate(...args) },
        card: { createMany: (...args: unknown[]) => mockCardCreateMany(...args) },
        auditLog: { create: (...args: unknown[]) => mockAuditLogCreate(...args) },
      };
      return fn(tx);
    }),
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
jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Provide a CRON_SECRET for seedBuiltInTemplates tests
const TEST_CRON_SECRET = "test_cron_secret";
process.env.CRON_SECRET = TEST_CRON_SECRET;

// ─── Import AFTER mocks are in place ─────────────────────────────────────────

import {
  getTemplates,
  getTemplateById,
  createBoardFromTemplate,
  seedBuiltInTemplates,
} from "@/actions/template-actions";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTemplateFindManyResult(overrides = {}) {
  return [
    {
      id: "tpl_1",
      title: "Kanban Board",
      description: "Classic kanban",
      category: "Engineering",
      orgId: null,
      imageThumbUrl: null,
      _count: { lists: 4 },
      ...overrides,
    },
  ];
}

function makeTemplateDetail() {
  return {
    id: "tpl_1",
    title: "Kanban Board",
    description: "Classic kanban",
    category: "Engineering",
    orgId: null,
    imageThumbUrl: null,
    lists: [
      {
        id: "lst_1",
        title: "Backlog",
        order: "a",
        cards: [
          { id: "crd_1", title: "Task 1", order: "a" },
          { id: "crd_2", title: "Task 2", order: "b" },
        ],
      },
      { id: "lst_2", title: "In Progress", order: "b", cards: [] },
    ],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── getTemplates ──────────────────────────────────────────────────────────────

describe("getTemplates", () => {
  it("returns mapped TemplateSummary array", async () => {
    mockBoardTemplateFindMany.mockResolvedValue(makeTemplateFindManyResult());

    const result = await getTemplates();

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data![0]).toMatchObject({
      id: "tpl_1",
      title: "Kanban Board",
      category: "Engineering",
      listCount: 4,
    });
  });

  it("returns empty array when no templates exist", async () => {
    mockBoardTemplateFindMany.mockResolvedValue([]);
    const result = await getTemplates();
    expect(result.data).toHaveLength(0);
  });

  it("queries both global and org-specific templates via OR clause", async () => {
    mockBoardTemplateFindMany.mockResolvedValue([]);
    await getTemplates();

    const callArg = mockBoardTemplateFindMany.mock.calls[0][0];
    expect(callArg.where.OR).toEqual([{ orgId: null }, { orgId: mockCtx.orgId }]);
  });

  it("includes _count for lists", async () => {
    mockBoardTemplateFindMany.mockResolvedValue(makeTemplateFindManyResult({ _count: { lists: 7 } }));
    const result = await getTemplates();
    expect(result.data![0].listCount).toBe(7);
  });

  it("maps imageThumbUrl correctly", async () => {
    mockBoardTemplateFindMany.mockResolvedValue(
      makeTemplateFindManyResult({ imageThumbUrl: "https://img.example.com/thumb.jpg" })
    );
    const result = await getTemplates();
    expect(result.data![0].imageThumbUrl).toBe("https://img.example.com/thumb.jpg");
  });
});

// ── getTemplateById ───────────────────────────────────────────────────────────

describe("getTemplateById", () => {
  it("returns TemplateDetail with lists and cards", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(makeTemplateDetail());

    const result = await getTemplateById("tpl_1");

    expect(result.error).toBeUndefined();
    expect(result.data).toMatchObject({
      id: "tpl_1",
      title: "Kanban Board",
      listCount: 2,
    });
    expect(result.data!.lists).toHaveLength(2);
    expect(result.data!.lists[0].cards).toHaveLength(2);
  });

  it("returns error when template not found", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(null);
    const result = await getTemplateById("non_existent");
    expect(result.error).toBe("Template not found");
    expect(result.data).toBeUndefined();
  });

  it("queries by id AND org ownership", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(makeTemplateDetail());
    await getTemplateById("tpl_1");

    const callArg = mockBoardTemplateFindFirst.mock.calls[0][0];
    expect(callArg.where.id).toBe("tpl_1");
    expect(callArg.where.OR).toEqual([{ orgId: null }, { orgId: mockCtx.orgId }]);
  });

  it("includes nested lists and cards in query", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(makeTemplateDetail());
    await getTemplateById("tpl_1");

    const callArg = mockBoardTemplateFindFirst.mock.calls[0][0];
    expect(callArg.include.lists).toBeDefined();
    expect(callArg.include.lists.include.cards).toBeTruthy();
  });
});

// ── createBoardFromTemplate ───────────────────────────────────────────────────

describe("createBoardFromTemplate", () => {
  beforeEach(() => {
    // getTemplateById internally calls findFirst; return a valid template
    mockBoardTemplateFindFirst.mockResolvedValue(makeTemplateDetail());
    mockBoardCreate.mockResolvedValue({ id: "board_new", title: "My Board" });
    mockListCreate.mockImplementation((args) =>
      Promise.resolve({ id: `lst_new_${Math.random().toString(36).slice(2)}`, ...args.data })
    );
    mockCardCreateMany.mockResolvedValue({ count: 2 });
    mockAuditLogCreate.mockResolvedValue({});
  });

  it("returns new boardId on success", async () => {
    const result = await createBoardFromTemplate({
      templateId: "tpl_1",
      title: "My Board",
    });

    expect(result.error).toBeUndefined();
    expect(result.data?.boardId).toBe("board_new");
  });

  it("creates board with correct orgId", async () => {
    await createBoardFromTemplate({ templateId: "tpl_1", title: "My Board" });
    expect(mockBoardCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orgId: mockCtx.orgId }) })
    );
  });

  it("passes image fields to board create", async () => {
    await createBoardFromTemplate({
      templateId: "tpl_1",
      title: "My Board",
      imageId: "photo_1",
      imageThumbUrl: "https://thumb.example.com",
      imageFullUrl: "https://full.example.com",
      imageUserName: "photographer",
      imageLinkUrl: 'https://unsplash.com/@photographer',
    });

    expect(mockBoardCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          imageId: "photo_1",
          imageThumbUrl: "https://thumb.example.com",
          imageUserName: "photographer",
        }),
      })
    );
  });

  it("creates a list for each template list", async () => {
    await createBoardFromTemplate({ templateId: "tpl_1", title: "My Board" });
    // Template has 2 lists
    expect(mockListCreate).toHaveBeenCalledTimes(2);
  });

  it("creates cards for non-empty lists", async () => {
    await createBoardFromTemplate({ templateId: "tpl_1", title: "My Board" });
    // First list has 2 cards; second is empty -> createMany called once
    expect(mockCardCreateMany).toHaveBeenCalledTimes(1);
    expect(mockCardCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ title: "Task 1" })]) })
    );
  });

  it("creates audit log entry", async () => {
    await createBoardFromTemplate({ templateId: "tpl_1", title: "My Board" });
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "CREATE",
          entityType: "BOARD",
          orgId: mockCtx.orgId,
        }),
      })
    );
  });

  it("returns error when template not found", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(null);
    const result = await createBoardFromTemplate({
      templateId: "non_existent",
      title: "My Board",
    });
    expect(result.error).toBeTruthy();
  });

  it("returns error when board create fails", async () => {
    mockBoardCreate.mockRejectedValue(new Error("DB connection error"));
    const result = await createBoardFromTemplate({ templateId: "tpl_1", title: "My Board" });
    expect(result.error).toBe("Failed to create board from template");
  });
});

// ── seedBuiltInTemplates ──────────────────────────────────────────────────────

describe("seedBuiltInTemplates", () => {
  it("skips templates that already exist", async () => {
    // All templates "exist"
    mockBoardTemplateFindFirst.mockResolvedValue({ id: "existing" });

    await seedBuiltInTemplates(TEST_CRON_SECRET);

    expect(mockBoardTemplateCreate).not.toHaveBeenCalled();
  });

  it("creates 6 templates on a fresh DB", async () => {
    // Nothing exists
    mockBoardTemplateFindFirst.mockResolvedValue(null);
    mockBoardTemplateCreate.mockResolvedValue({});

    await seedBuiltInTemplates(TEST_CRON_SECRET);

    expect(mockBoardTemplateCreate).toHaveBeenCalledTimes(6);
  });

  it("seeds with orgId null (global templates)", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(null);
    mockBoardTemplateCreate.mockResolvedValue({});

    await seedBuiltInTemplates(TEST_CRON_SECRET);

    const firstCall = mockBoardTemplateCreate.mock.calls[0][0];
    expect(firstCall.data.orgId).toBeNull();
  });

  it("includes list and card structure in seed data", async () => {
    mockBoardTemplateFindFirst.mockResolvedValue(null);
    mockBoardTemplateCreate.mockResolvedValue({});

    await seedBuiltInTemplates(TEST_CRON_SECRET);

    const firstCall = mockBoardTemplateCreate.mock.calls[0][0];
    expect(firstCall.data.lists?.create).toBeDefined();
    expect(Array.isArray(firstCall.data.lists.create)).toBe(true);
    expect(firstCall.data.lists.create.length).toBeGreaterThan(0);
  });

  it("seeds only missing templates when some exist", async () => {
    let callCount = 0;
    mockBoardTemplateFindFirst.mockImplementation(() => {
      callCount++;
      // First 3 "exist", rest don't
      return callCount <= 3 ? Promise.resolve({ id: "exists" }) : Promise.resolve(null);
    });
    mockBoardTemplateCreate.mockResolvedValue({});

    await seedBuiltInTemplates(TEST_CRON_SECRET);

    // 6 total templates, 3 exist -> 3 created
    expect(mockBoardTemplateCreate).toHaveBeenCalledTimes(3);
  });

  it("throws when called without a valid CRON_SECRET", async () => {
    await expect(seedBuiltInTemplates("wrong_secret")).rejects.toThrow("Unauthorized");
    await expect(seedBuiltInTemplates()).rejects.toThrow("Unauthorized");
  });
});
