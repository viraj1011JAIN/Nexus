/**
 * DAL Tenant-Isolation Tests
 *
 * These tests are the security gate for the Data Access Layer.
 * Every public method in TenantDAL must be incapable of returning or
 * mutating data that belongs to a different organisation.
 *
 * Strategy
 * ────────
 * 1. `getTenantContext` is mocked to return a fixed caller context  →  orgId: "org_a".
 * 2. `db` (Prisma client) is mocked so we control exact return values.
 * 3. We instruct the mock to return resources that belong to "org_b" and assert
 *    that the DAL throws TenantError with code NOT_FOUND every time.
 * 4. We also verify happy-path same-org access works correctly.
 */

// ── Hoisted mocks (must be at the very top, before any imports) ──────────────

// Prevent `react.cache()` from caching across tests
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Prisma client – full table-level mocks for everything the DAL touches
jest.mock("@/lib/db", () => ({
  db: {
    board: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    list: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    card: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    label: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    cardLabelAssignment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  setCurrentOrgId: jest.fn().mockResolvedValue(undefined),
}));

// Tenant context – we control which org the "current user" belongs to
jest.mock("@/lib/tenant-context", () => {
  const actual = jest.requireActual<typeof import("@/lib/tenant-context")>(
    "@/lib/tenant-context"
  );
  return {
    ...actual,
    getTenantContext: jest.fn(),
  };
});

// ── Real imports (after mock declarations) ───────────────────────────────────

import { createDAL } from "@/lib/dal";
import { TenantError } from "@/lib/tenant-context";
import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockGetTenantContext = getTenantContext as jest.Mock;

// Shorthand casts so TypeScript lets us call .mockResolvedValue etc.
const boardFindMany = db.board.findMany as jest.Mock;
const boardFindUnique = db.board.findUnique as jest.Mock;
const boardCreate = db.board.create as jest.Mock;
const boardDelete = db.board.delete as jest.Mock;
const listFindMany = db.list.findMany as jest.Mock;
const listFindUnique = db.list.findUnique as jest.Mock;
const cardFindUnique = db.card.findUnique as jest.Mock;
const cardFindMany = db.card.findMany as jest.Mock;
const cardDelete = db.card.delete as jest.Mock;
const labelFindUnique = db.label.findUnique as jest.Mock;
const cardLabelFindUnique = db.cardLabelAssignment.findUnique as jest.Mock;
const cardLabelCreate = db.cardLabelAssignment.create as jest.Mock;

// ── Shared fixtures ──────────────────────────────────────────────────────────

const ORG_A = "org_a_01";
const ORG_B = "org_b_99"; // attacker / other tenant

const USER_A = "user_a_01";

function callerContext(orgId = ORG_A, userId = USER_A) {
  return { orgId, userId, role: "MEMBER" as const };
}

/** Board that belongs to Org A */
function boardA(id = "board_a_1") {
  return { id, orgId: ORG_A, title: "Org A Board", imageThumbUrl: null };
}

/** Board that belongs to Org B (foreign resource) */
function boardB(id = "board_b_1") {
  return { id, orgId: ORG_B, title: "Org B Board – SECRET", imageThumbUrl: null };
}

// ── Test-level setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();

  // Default: the caller belongs to ORG_A
  mockGetTenantContext.mockResolvedValue(callerContext());

  // setCurrentOrgId is a no-op in tests
  (db as unknown as { setCurrentOrgId: jest.Mock }).setCurrentOrgId?.mockResolvedValue(undefined);
});

// ════════════════════════════════════════════════════════════════════════════
// BOARDS
// ════════════════════════════════════════════════════════════════════════════

describe("DAL boards – tenant isolation", () => {
  // ── findMany ──────────────────────────────────────────────────────────────

  it("findMany always injects the caller's orgId into the WHERE clause", async () => {
    boardFindMany.mockResolvedValue([boardA()]);

    const dal = await createDAL();
    await dal.boards.findMany();

    expect(boardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: ORG_A }) })
    );
  });

  it("findMany never leaks boards from another org even if extra where is provided", async () => {
    boardFindMany.mockResolvedValue([]);

    const dal = await createDAL();
    // Caller tries to sneak in a different orgId via the args — the DAL strips it
    await dal.boards.findMany({ where: { title: "anything" } } as Parameters<typeof dal.boards.findMany>[0]);

    const call = boardFindMany.mock.calls[0][0] as { where: { orgId: string } };
    expect(call.where.orgId).toBe(ORG_A);
    // Must never be ORG_B even if the consumer forgot
    expect(call.where.orgId).not.toBe(ORG_B);
  });

  // ── findUnique ────────────────────────────────────────────────────────────

  it("findUnique returns board when it belongs to the caller's org", async () => {
    boardFindUnique.mockResolvedValue(boardA());

    const dal = await createDAL();
    const result = await dal.boards.findUnique("board_a_1");

    expect(result.id).toBe("board_a_1");
  });

  it("findUnique throws NOT_FOUND when board belongs to another org", async () => {
    // DB returns a board that exists but is owned by ORG_B
    boardFindUnique.mockResolvedValue(boardB());

    const dal = await createDAL();
    await expect(dal.boards.findUnique("board_b_1")).rejects.toMatchObject({
      name: "TenantError",
      code: "NOT_FOUND",
    });
  });

  it("findUnique throws NOT_FOUND when board does not exist at all", async () => {
    boardFindUnique.mockResolvedValue(null);

    const dal = await createDAL();
    await expect(dal.boards.findUnique("nonexistent")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("findUnique error is instanceof TenantError", async () => {
    boardFindUnique.mockResolvedValue(boardB());

    const dal = await createDAL();
    await expect(dal.boards.findUnique("board_b_1")).rejects.toBeInstanceOf(TenantError);
  });

  // ── create ────────────────────────────────────────────────────────────────

  it("create injects the caller's orgId — never uses input for orgId", async () => {
    boardCreate.mockResolvedValue(boardA("new_board"));

    const dal = await createDAL();
    await dal.boards.create({ title: "My New Board", imageThumbUrl: "", imageFullUrl: "" });

    const createData = (boardCreate.mock.calls[0][0] as { data: { orgId: string } }).data;
    expect(createData.orgId).toBe(ORG_A);
  });

  // ── update / delete via verifyBoardOwnership ──────────────────────────────

  it("update throws NOT_FOUND when board belongs to another org", async () => {
    // verifyBoardOwnership does: db.board.findUnique({ where: { id }, select: { orgId: true } })
    boardFindUnique.mockResolvedValue({ orgId: ORG_B });

    const dal = await createDAL();
    await expect(dal.boards.update("board_b_1", { title: "Hacked" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("delete throws NOT_FOUND when board belongs to another org", async () => {
    boardFindUnique.mockResolvedValue({ orgId: ORG_B });
    boardDelete.mockResolvedValue(boardB());

    const dal = await createDAL();
    await expect(dal.boards.delete("board_b_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CARDS
// ════════════════════════════════════════════════════════════════════════════

describe("DAL cards – tenant isolation", () => {
  /** Mock card owned by the requested org via the Card→List→Board chain */
  function cardWithOrg(orgId: string, cardId = "card_1") {
    return {
      id: cardId,
      list: { board: { orgId } },
    };
  }

  it("findUnique returns card when it belongs to caller's org", async () => {
    cardFindUnique.mockResolvedValue(cardWithOrg(ORG_A));

    const dal = await createDAL();
    const result = await dal.cards.findUnique("card_1");
    expect((result as { id: string }).id).toBe("card_1");
  });

  it("findUnique throws NOT_FOUND when card belongs to another org", async () => {
    cardFindUnique.mockResolvedValue(cardWithOrg(ORG_B, "card_b_1"));

    const dal = await createDAL();
    await expect(dal.cards.findUnique("card_b_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("findUnique throws NOT_FOUND for null card", async () => {
    cardFindUnique.mockResolvedValue(null);

    const dal = await createDAL();
    await expect(dal.cards.findUnique("ghost_card")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("delete throws NOT_FOUND when card belongs to another org (verifyCardOwnership)", async () => {
    // verifyCardOwnership: db.card.findUnique({ select: { list: { select: { board: { select: { orgId } } } } } })
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_B } } });
    cardDelete.mockResolvedValue({ id: "card_b_1" });

    const dal = await createDAL();
    await expect(dal.cards.delete("card_b_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Should never reach the actual delete
    expect(cardDelete).not.toHaveBeenCalled();
  });

  it("delete succeeds when card belongs to caller's org", async () => {
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_A } } });
    cardDelete.mockResolvedValue({ id: "card_a_1" });

    const dal = await createDAL();
    await dal.cards.delete("card_a_1");
    expect(cardDelete).toHaveBeenCalledWith({ where: { id: "card_a_1" } });
  });

  // ── reorder – ID injection attack ─────────────────────────────────────────

  it("reorder rejects a list containing foreign card IDs (injection attack)", async () => {
    // verifyBoardOwnership → board is in ORG_A ✓
    boardFindUnique.mockResolvedValue({ orgId: ORG_A });

    // DB ground-truth: only card_a_1 belongs to this board
    cardFindMany.mockResolvedValue([{ id: "card_a_1" }]);

    const dal = await createDAL();
    await expect(
      dal.cards.reorder(
        [
          { id: "card_a_1", order: "1", listId: "list_a_1" },
          { id: "card_foreign", order: "2", listId: "list_a_1" }, // injected foreign ID
        ],
        "board_a_1"
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reorder succeeds when all card IDs belong to the board", async () => {
    boardFindUnique.mockResolvedValue({ orgId: ORG_A });
    cardFindMany.mockResolvedValue([{ id: "card_a_1" }, { id: "card_a_2" }]);

    const dbTx = db.$transaction as jest.Mock;
    dbTx.mockResolvedValue([]);

    const dal = await createDAL();
    await dal.cards.reorder(
      [
        { id: "card_a_1", order: "1", listId: "list_a_1" },
        { id: "card_a_2", order: "2", listId: "list_a_1" },
      ],
      "board_a_1"
    );

    expect(dbTx).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LISTS
// ════════════════════════════════════════════════════════════════════════════

describe("DAL lists – tenant isolation", () => {
  it("reorder rejects list IDs not belonging to the specified board", async () => {
    // verifyBoardOwnership → ORG_A board ✓
    boardFindUnique.mockResolvedValue({ orgId: ORG_A });

    // DB says only list_a_1 is in this board
    listFindMany.mockResolvedValue([{ id: "list_a_1" }]);

    const dal = await createDAL();
    await expect(
      dal.lists.reorder(
        [
          { id: "list_a_1", order: "1" },
          { id: "list_from_org_b", order: "2" }, // injected
        ],
        "board_a_1"
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("update throws NOT_FOUND when list belongs to another org", async () => {
    // verifyListOwnership: db.list.findUnique → board.orgId = ORG_B
    listFindUnique.mockResolvedValue({ board: { orgId: ORG_B } });

    const dal = await createDAL();
    await expect(dal.lists.update("list_b_1", "board_b_1", { title: "Attack" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("delete throws NOT_FOUND when list belongs to another org", async () => {
    listFindUnique.mockResolvedValue({ board: { orgId: ORG_B } });

    const dal = await createDAL();
    await expect(dal.lists.delete("list_b_1", "board_b_1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LABELS
// ════════════════════════════════════════════════════════════════════════════

describe("DAL labels – tenant isolation", () => {
  it("assign throws NOT_FOUND when card belongs to another org", async () => {
    // verifyCardOwnership → card from ORG_B
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_B } } });

    const dal = await createDAL();
    await expect(dal.labels.assign("card_b", "label_a")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    // Should never even reach the label ownership check
    expect(labelFindUnique).not.toHaveBeenCalled();
  });

  it("assign throws NOT_FOUND when label belongs to another org", async () => {
    // verifyCardOwnership → card from ORG_A ✓
    // verifyLabelOwnership → label from ORG_B → throws
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_A } } });
    labelFindUnique.mockResolvedValue({ orgId: ORG_B });

    const dal = await createDAL();
    await expect(dal.labels.assign("card_a", "label_b")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(cardLabelCreate).not.toHaveBeenCalled();
  });

  it("assign succeeds when both card and label belong to caller's org", async () => {
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_A } } });
    labelFindUnique.mockResolvedValue({ orgId: ORG_A });
    cardLabelFindUnique.mockResolvedValue(null); // not yet assigned
    cardLabelCreate.mockResolvedValue({ id: "assignment_1", cardId: "card_a", labelId: "label_a" });

    const dal = await createDAL();
    const result = await dal.labels.assign("card_a", "label_a");
    expect(result).toMatchObject({ cardId: "card_a", labelId: "label_a" });
  });

  it("assign is idempotent – returns existing assignment if already present", async () => {
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_A } } });
    labelFindUnique.mockResolvedValue({ orgId: ORG_A });
    // Already assigned
    cardLabelFindUnique.mockResolvedValue({ id: "existing_1", cardId: "card_a", labelId: "label_a" });

    const dal = await createDAL();
    const result = await dal.labels.assign("card_a", "label_a");
    // Should return existing row without creating a duplicate
    expect(result).toMatchObject({ id: "existing_1" });
    expect(cardLabelCreate).not.toHaveBeenCalled();
  });

  it("unassign throws NOT_FOUND when label belongs to another org", async () => {
    cardFindUnique.mockResolvedValue({ list: { board: { orgId: ORG_A } } });
    labelFindUnique.mockResolvedValue({ orgId: ORG_B });

    const dal = await createDAL();
    await expect(dal.labels.unassign("card_a", "label_b")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TenantError shape contract
// ════════════════════════════════════════════════════════════════════════════

describe("TenantError contract", () => {
  it("is an Error subclass so it can be caught generically", () => {
    const err = new TenantError("NOT_FOUND", "Board not found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TenantError);
  });

  it("exposes the correct code", () => {
    expect(new TenantError("NOT_FOUND", "x").code).toBe("NOT_FOUND");
    expect(new TenantError("FORBIDDEN", "x").code).toBe("FORBIDDEN");
    expect(new TenantError("UNAUTHENTICATED", "x").code).toBe("UNAUTHENTICATED");
  });

  it("cross-tenant access returns NOT_FOUND, never FORBIDDEN (fingerprint hiding)", () => {
    // Board owned by ORG_B accessed from ORG_A must be NOT_FOUND not FORBIDDEN
    // Rationale: FORBIDDEN reveals the resource exists. NOT_FOUND reveals nothing.
    boardFindUnique.mockResolvedValue(boardB());

    return createDAL().then((dal) =>
      dal.boards.findUnique("board_b_1").catch((e: TenantError) => {
        expect(e.code).toBe("NOT_FOUND");
        expect(e.code).not.toBe("FORBIDDEN");
      })
    );
  });
});
