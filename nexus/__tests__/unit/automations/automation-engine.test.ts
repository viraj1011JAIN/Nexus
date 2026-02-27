/**
 * Section 7 — Automation Engine Tests
 *
 * Directly tests runAutomations() from lib/automation-engine.ts
 *
 * Covers:
 *   7.1  Recursion depth guard (MAX_DEPTH = 3 — engine uses `depth > 3` boundary)
 *   7.2  Invalid / silently-ignored trigger types
 *   7.3  CARD_CREATED   — happy path + edge
 *   7.4  CARD_MOVED     — happy path + listId matching + edge
 *   7.5  CARD_DUE_SOON  — time-window matching + edges
 *   7.6  CARD_OVERDUE   — happy path + missing action config
 *   7.7  LABEL_ADDED    — happy path + labelId matching + edge
 *   7.8  CHECKLIST_COMPLETED — happy path + invalid assigneeId guard
 *   7.9  MEMBER_ASSIGNED     — happy path + missing labelId
 *   7.10 PRIORITY_CHANGED    — happy path + org-mismatch (automation not loaded)
 *   7.11 CARD_TITLE_CONTAINS — keyword matching (case-insensitive) + edge
 *   7.12 MOVE_CARD action    — wraps read+update in db.$transaction; concurrent guarantee
 *   7.13 SET_DUE_DATE_OFFSET — with/without existing dueDate
 *   7.14 ADD_LABEL / REMOVE_LABEL actions
 *   7.15 POST_COMMENT action — SYSTEM_USER_ID guard
 *   7.16 SEND_NOTIFICATION action — assignee + SYSTEM_USER_ID guards
 *   7.17 COMPLETE_CHECKLIST action
 *   7.18 Logging — success=true, success=false, runCount
 *   7.19 Conditions — eq pass / fail gate
 */

import { runAutomations } from "@/lib/automation-engine";
import { db } from "@/lib/db";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID        = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOARD_ID      = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_ID       = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LIST_ID       = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER_LIST_ID = "11111111-1111-4111-8111-111111111111";
const LABEL_ID      = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CHECKLIST_ID  = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const AUTOMATION_ID = "22222222-2222-4222-8222-222222222222";
const ASSIGNEE_ID   = "33333333-3333-4333-8333-333333333333";
const SYSTEM_USER   = "system_bot_44444444";

/** Base card row with all engine-required nested relations. */
const BASE_CARD = {
  id:         CARD_ID,
  title:      "Fix authentication bug",
  listId:     LIST_ID,
  priority:   "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  dueDate:    null as Date | null,
  assigneeId: null as string | null,
  list:       { id: LIST_ID, title: "Todo", boardId: BOARD_ID },
  labels:     [] as unknown[],
  checklists: [] as unknown[],
};

/** Build a minimal Automation DB row for mock returns. */
function makeAutomation(
  triggerType: string,
  actions: object[],
  triggerExtra: object = {},
  conditions: object[] = [],
) {
  return {
    id:        AUTOMATION_ID,
    orgId:     ORG_ID,
    boardId:   BOARD_ID,
    name:      "Test Automation",
    isEnabled: true,
    trigger:   { type: triggerType, ...triggerExtra },
    conditions,
    actions,
  };
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock("@/lib/db", () => ({
  db: {
    automation:          { findMany: jest.fn(), update:  jest.fn() },
    card:                { findUnique: jest.fn(), update: jest.fn() },
    cardLabelAssignment: { upsert:    jest.fn(), deleteMany: jest.fn() },
    checklistItem:       { updateMany: jest.fn() },
    automationLog:       { create:    jest.fn() },
    notification:        { create:    jest.fn() },
    comment:             { create:    jest.fn() },
    user:                { findUnique: jest.fn() },
    $transaction:        jest.fn(),
  },
}));

// ─── Default mock wiring ──────────────────────────────────────────────────────

/**
 * Wire up all db mocks to sensible defaults so each individual test only needs
 * to override the specific mock it cares about.
 *
 * @param cardOverride – partial card fields to merge over BASE_CARD
 */
function setupDefaultMocks(cardOverride: Partial<typeof BASE_CARD> = {}) {
  const card = { ...BASE_CARD, ...cardOverride };

  (db.automation.findMany         as jest.Mock).mockResolvedValue([]);
  (db.card.findUnique             as jest.Mock).mockResolvedValue(card);
  (db.automation.update           as jest.Mock).mockResolvedValue({});
  (db.automationLog.create        as jest.Mock).mockResolvedValue({});
  (db.card.update                 as jest.Mock).mockResolvedValue({});
  (db.cardLabelAssignment.upsert  as jest.Mock).mockResolvedValue({});
  (db.cardLabelAssignment.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
  (db.checklistItem.updateMany    as jest.Mock).mockResolvedValue({ count: 1 });
  (db.comment.create              as jest.Mock).mockResolvedValue({});
  (db.user.findUnique             as jest.Mock).mockResolvedValue(null);
  (db.notification.create         as jest.Mock).mockResolvedValue({});

  // $transaction: execute the callback with a tx mock so MOVE_CARD works end-to-end.
  (db.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        card: {
          findFirst: jest.fn().mockResolvedValue({ order: "m" }),
          update:    jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    },
  );
}

// ─── Base event ───────────────────────────────────────────────────────────────

const BASE_EVENT = {
  type:    "CARD_CREATED" as const,
  orgId:   ORG_ID,
  boardId: BOARD_ID,
  cardId:  CARD_ID,
};

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 7 — Automation Engine", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupDefaultMocks();
  });

  // ─── 7.1 Depth Guard ────────────────────────────────────────────────────────

  describe("7.1 Depth Guard (MAX_DEPTH = 3)", () => {
    it("should run normally when _depth is 0", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([]);
      await runAutomations({ ...BASE_EVENT, _depth: 0 });
      expect(db.automation.findMany).toHaveBeenCalledTimes(1);
    });

    it("should run normally when _depth is exactly 3 (boundary — NOT exceeded)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([]);
      await runAutomations({ ...BASE_EVENT, _depth: 3 });
      // depth(3) > MAX_DEPTH(3) is false → engine proceeds
      expect(db.automation.findMany).toHaveBeenCalledTimes(1);
    });

    it("should halt silently when _depth is 4 (exceeds MAX_DEPTH)", async () => {
      await runAutomations({ ...BASE_EVENT, _depth: 4 });
      // Engine must abort BEFORE querying the DB
      expect(db.automation.findMany).not.toHaveBeenCalled();
    });

    it("should default _depth to 0 when the property is omitted", async () => {
      const event = { type: "CARD_CREATED" as const, orgId: ORG_ID, boardId: BOARD_ID, cardId: CARD_ID };
      (db.automation.findMany as jest.Mock).mockResolvedValue([]);
      await runAutomations(event);
      expect(db.automation.findMany).toHaveBeenCalledTimes(1);
    });

    it("should never throw — all engine errors are caught silently", async () => {
      (db.automation.findMany as jest.Mock).mockRejectedValue(new Error("DB connection lost"));
      await expect(runAutomations({ ...BASE_EVENT, _depth: 0 })).resolves.toBeUndefined();
    });
  });

  // ─── 7.2 Invalid / Silently Ignored Triggers ────────────────────────────────

  describe("7.2 Invalid / Silently Ignored Triggers", () => {
    it("should ignore automation when trigger.type is INVALID_TRIGGER", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("INVALID_TRIGGER", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      await runAutomations(BASE_EVENT);
      // The trigger type never matches → SET_PRIORITY (db.card.update) never called
      expect(db.card.update).not.toHaveBeenCalled();
      expect(db.automationLog.create).not.toHaveBeenCalled();
    });

    it("should NOT fire on CARD_DELETED events (triggerMatches hard-returns false)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_DELETED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_DELETED" });
      expect(db.card.update).not.toHaveBeenCalled();
      expect(db.automationLog.create).not.toHaveBeenCalled();
    });

    it("should return early (no card fetch) when automation list is empty", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([]);
      await runAutomations(BASE_EVENT);
      expect(db.card.findUnique).not.toHaveBeenCalled();
    });

    it("should return early when the card no longer exists at engine time", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      (db.card.findUnique as jest.Mock).mockResolvedValue(null);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.3 CARD_CREATED ───────────────────────────────────────────────────────

  describe("7.3 CARD_CREATED", () => {
    it("happy path: fires SET_PRIORITY and writes a success log", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: CARD_ID }, data: { priority: "HIGH" } }),
      );
      expect(db.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ success: true }) }),
      );
    });

    it("edge: card deleted between findAutomations and card fetch → no action executed", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      (db.card.findUnique as jest.Mock).mockResolvedValue(null);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.4 CARD_MOVED ─────────────────────────────────────────────────────────

  describe("7.4 CARD_MOVED", () => {
    const movedEvent = {
      ...BASE_EVENT,
      type:    "CARD_MOVED" as const,
      context: { fromListId: LIST_ID, toListId: OTHER_LIST_ID },
    };

    it("happy path: fires when trigger has no fromListId constraint", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_MOVED", [{ type: "SET_PRIORITY", priority: "URGENT" }]),
      ]);
      await runAutomations(movedEvent);
      expect(db.card.update).toHaveBeenCalled();
    });

    it("happy path: fires when trigger.listId matches event.context.fromListId", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_MOVED", [{ type: "SET_PRIORITY", priority: "HIGH" }], { listId: LIST_ID }),
      ]);
      await runAutomations(movedEvent);
      expect(db.card.update).toHaveBeenCalled();
    });

    it("edge: trigger.listId does NOT match fromListId → automation is skipped", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_MOVED", [{ type: "SET_PRIORITY", priority: "HIGH" }], { listId: "different-list" }),
      ]);
      await runAutomations(movedEvent);
      expect(db.card.update).not.toHaveBeenCalled();
      expect(db.automationLog.create).not.toHaveBeenCalled();
    });

    it("edge: CARD_CREATED event type does not match CARD_MOVED trigger", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_MOVED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      // Fire CARD_CREATED, not CARD_MOVED
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.5 CARD_DUE_SOON ──────────────────────────────────────────────────────

  describe("7.5 CARD_DUE_SOON", () => {
    it("happy path: fires when dueDate is within the configured days window (12 h < 1 d)", async () => {
      const dueSoon = new Date(Date.now() + 12 * 60 * 60 * 1000);
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_DUE_SOON", [{ type: "SET_PRIORITY", priority: "URGENT" }], { daysBeforeDue: 1 }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_DUE_SOON", context: { dueDate: dueSoon } });
      expect(db.card.update).toHaveBeenCalled();
    });

    it("edge: no dueDate in event context → trigger skipped", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_DUE_SOON", [{ type: "SET_PRIORITY", priority: "URGENT" }], { daysBeforeDue: 1 }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_DUE_SOON", context: {} });
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("edge: dueDate is 10 days out — beyond 1-day window → trigger skipped", async () => {
      const farFuture = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_DUE_SOON", [{ type: "SET_PRIORITY", priority: "URGENT" }], { daysBeforeDue: 1 }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_DUE_SOON", context: { dueDate: farFuture } });
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("edge: dueDate is a serialised ISO string (not a Date object) → parsed correctly", async () => {
      // Engine does `new Date(rawDueDate)` so ISO strings are valid input
      const dueSoonIso = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_DUE_SOON", [{ type: "SET_PRIORITY", priority: "HIGH" }], { daysBeforeDue: 1 }),
      ]);
      await runAutomations({
        ...BASE_EVENT,
        type: "CARD_DUE_SOON",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context: { dueDate: dueSoonIso as any },
      });
      expect(db.card.update).toHaveBeenCalled();
    });
  });

  // ─── 7.6 CARD_OVERDUE ───────────────────────────────────────────────────────

  describe("7.6 CARD_OVERDUE", () => {
    it("happy path: fires and upgrades priority to URGENT", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_OVERDUE", [{ type: "SET_PRIORITY", priority: "URGENT" }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_OVERDUE" });
      expect(db.card.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { priority: "URGENT" } }),
      );
    });

    it("edge: action has no priority field configured → db.card.update NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_OVERDUE", [{ type: "SET_PRIORITY" /* no priority */ }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_OVERDUE" });
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.7 LABEL_ADDED ────────────────────────────────────────────────────────

  describe("7.7 LABEL_ADDED", () => {
    it("happy path: fires when trigger has no labelId constraint", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("LABEL_ADDED", [{ type: "SET_PRIORITY", priority: "LOW" }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "LABEL_ADDED", context: { labelId: LABEL_ID } });
      expect(db.card.update).toHaveBeenCalled();
    });

    it("happy path: fires when trigger.labelId matches event.context.labelId", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("LABEL_ADDED", [{ type: "SET_PRIORITY", priority: "HIGH" }], { labelId: LABEL_ID }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "LABEL_ADDED", context: { labelId: LABEL_ID } });
      expect(db.card.update).toHaveBeenCalled();
    });

    it("edge: trigger.labelId does NOT match event labelId → automation is skipped", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("LABEL_ADDED", [{ type: "SET_PRIORITY", priority: "HIGH" }], { labelId: "other-label" }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "LABEL_ADDED", context: { labelId: LABEL_ID } });
      expect(db.card.update).not.toHaveBeenCalled();
      expect(db.automationLog.create).not.toHaveBeenCalled();
    });
  });

  // ─── 7.8 CHECKLIST_COMPLETED ────────────────────────────────────────────────

  describe("7.8 CHECKLIST_COMPLETED", () => {
    it("happy path: fires ASSIGN_MEMBER action with valid assigneeId", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CHECKLIST_COMPLETED", [{ type: "ASSIGN_MEMBER", assigneeId: ASSIGNEE_ID }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CHECKLIST_COMPLETED" });
      expect(db.card.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assigneeId: ASSIGNEE_ID } }),
      );
    });

    it("edge: empty string assigneeId → ASSIGN_MEMBER skipped (engine guards against invalid IDs)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CHECKLIST_COMPLETED", [{ type: "ASSIGN_MEMBER", assigneeId: "" }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CHECKLIST_COMPLETED" });
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.9 MEMBER_ASSIGNED ────────────────────────────────────────────────────

  describe("7.9 MEMBER_ASSIGNED", () => {
    it("happy path: fires ADD_LABEL action to tag the card", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("MEMBER_ASSIGNED", [{ type: "ADD_LABEL", labelId: LABEL_ID }]),
      ]);
      await runAutomations({
        ...BASE_EVENT, type: "MEMBER_ASSIGNED", context: { assigneeId: ASSIGNEE_ID },
      });
      expect(db.cardLabelAssignment.upsert).toHaveBeenCalled();
    });

    it("edge: ADD_LABEL action missing labelId → upsert NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("MEMBER_ASSIGNED", [{ type: "ADD_LABEL" /* no labelId */ }]),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "MEMBER_ASSIGNED" });
      expect(db.cardLabelAssignment.upsert).not.toHaveBeenCalled();
    });
  });

  // ─── 7.10 PRIORITY_CHANGED ──────────────────────────────────────────────────

  describe("7.10 PRIORITY_CHANGED", () => {
    it("happy path: fires REMOVE_LABEL action", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("PRIORITY_CHANGED", [{ type: "REMOVE_LABEL", labelId: LABEL_ID }]),
      ]);
      await runAutomations({
        ...BASE_EVENT, type: "PRIORITY_CHANGED", context: { priority: "HIGH" as const },
      });
      expect(db.cardLabelAssignment.deleteMany).toHaveBeenCalled();
    });

    it("edge: org mismatch — db.automation.findMany returns empty list (filtered at DB level)", async () => {
      // Simulate what Prisma does: automations for a different org are never returned
      (db.automation.findMany as jest.Mock).mockResolvedValue([]);
      await runAutomations({ ...BASE_EVENT, type: "PRIORITY_CHANGED" });
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.11 CARD_TITLE_CONTAINS ───────────────────────────────────────────────

  describe("7.11 CARD_TITLE_CONTAINS", () => {
    it("happy path: fires when keyword is found in cardTitle (case-insensitive)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_TITLE_CONTAINS", [{ type: "SET_PRIORITY", priority: "HIGH" }], { keyword: "bug" }),
      ]);
      await runAutomations({
        ...BASE_EVENT,
        type:    "CARD_TITLE_CONTAINS",
        context: { cardTitle: "Fix Authentication BUG in Auth Module" },
      });
      expect(db.card.update).toHaveBeenCalled();
    });

    it("edge: keyword NOT found in cardTitle → automation is skipped", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_TITLE_CONTAINS", [{ type: "SET_PRIORITY", priority: "HIGH" }], { keyword: "urgent" }),
      ]);
      await runAutomations({
        ...BASE_EVENT,
        type:    "CARD_TITLE_CONTAINS",
        context: { cardTitle: "Fix Authentication Bug" },
      });
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("edge: trigger has no keyword configured → automation is always skipped", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_TITLE_CONTAINS", [{ type: "SET_PRIORITY", priority: "HIGH" }] /* no keyword */),
      ]);
      await runAutomations({
        ...BASE_EVENT,
        type:    "CARD_TITLE_CONTAINS",
        context: { cardTitle: "any title" },
      });
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("edge: cardTitle absent from context → trigger skipped (no crash)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_TITLE_CONTAINS", [{ type: "SET_PRIORITY", priority: "HIGH" }], { keyword: "bug" }),
      ]);
      await runAutomations({ ...BASE_EVENT, type: "CARD_TITLE_CONTAINS", context: {} });
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.12 Action: MOVE_CARD — $transaction serialisation ────────────────────

  describe("7.12 Action: MOVE_CARD — transaction serialisation", () => {
    it("should wrap the read+update in db.$transaction (preventing TOCTOU race)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("concurrent: two automations each use their own independent $transaction", async () => {
      const secondId = "55555555-5555-4555-8555-555555555555";
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
        {
          ...makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
          id: secondId,
        },
      ]);
      await runAutomations(BASE_EVENT);
      // Sequential execution: one transaction per automation
      expect(db.$transaction).toHaveBeenCalledTimes(2);
    });

    it("should compute newOrder by appending '~' to the last card's order", async () => {
      let capturedNewOrder: string | undefined;
      (db.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const tx = {
            card: {
              findFirst: jest.fn().mockResolvedValue({ order: "abc" }),
              update: jest.fn().mockImplementation(async (args: { data: { order: string } }) => {
                capturedNewOrder = args.data.order;
                return {};
              }),
            },
          };
          return fn(tx);
        },
      );
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      // incrementOrder("abc") appends '~' (0x7E, highest printable ASCII)
      expect(capturedNewOrder).toBe("abc~");
    });

    it("should use 'n' as initial order when target list has no existing cards", async () => {
      let capturedNewOrder: string | undefined;
      (db.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const tx = {
            card: {
              findFirst: jest.fn().mockResolvedValue(null),
              update: jest.fn().mockImplementation(async (args: { data: { order: string } }) => {
                capturedNewOrder = args.data.order;
                return {};
              }),
            },
          };
          return fn(tx);
        },
      );
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(capturedNewOrder).toBe("n");
    });

    it("should produce a fallback \\uFFFF rank when order string reaches 32 chars", async () => {
      const longOrder = "~".repeat(32); // ≥ MAX_ORDER_LENGTH
      let capturedNewOrder: string | undefined;
      (db.$transaction as jest.Mock).mockImplementation(
        async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
          const tx = {
            card: {
              findFirst: jest.fn().mockResolvedValue({ order: longOrder }),
              update: jest.fn().mockImplementation(async (args: { data: { order: string } }) => {
                capturedNewOrder = args.data.order;
                return {};
              }),
            },
          };
          return fn(tx);
        },
      );
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD", listId: OTHER_LIST_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      // Fallback rank always sorts last (starts with \uFFFF)
      expect(capturedNewOrder?.startsWith("\uFFFF")).toBe(true);
    });

    it("edge: MOVE_CARD action with no listId configured → $transaction NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "MOVE_CARD" /* no listId */ }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  // ─── 7.13 Action: SET_DUE_DATE_OFFSET ────────────────────────────────────────

  describe("7.13 Action: SET_DUE_DATE_OFFSET", () => {
    it("should update dueDate when card has an existing dueDate (offsets from it)", async () => {
      const existingDue = new Date("2026-04-01T12:00:00.000Z");
      setupDefaultMocks({ dueDate: existingDue });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_DUE_DATE_OFFSET", daysOffset: 7 }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ dueDate: expect.any(Date) }) }),
      );
    });

    it("should offset by the correct number of milliseconds", async () => {
      const existingDue = new Date("2026-04-01T00:00:00.000Z");
      const expectedDue = new Date(existingDue.getTime() + 3 * 24 * 60 * 60 * 1000);
      let capturedDueDate: Date | undefined;
      setupDefaultMocks({ dueDate: existingDue });
      (db.card.update as jest.Mock).mockImplementation(async (args: { data: { dueDate: Date } }) => {
        capturedDueDate = args.data.dueDate;
        return {};
      });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_DUE_DATE_OFFSET", daysOffset: 3 }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(capturedDueDate?.getTime()).toBe(expectedDue.getTime());
    });

    it("edge: card has no existing dueDate → offset skipped (nothing to offset from)", async () => {
      setupDefaultMocks({ dueDate: null });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_DUE_DATE_OFFSET", daysOffset: 7 }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });
  });

  // ─── 7.14 Action: ADD_LABEL / REMOVE_LABEL ────────────────────────────────────

  describe("7.14 Action: ADD_LABEL / REMOVE_LABEL", () => {
    it("ADD_LABEL: upserts cardLabelAssignment with correct composite key", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "ADD_LABEL", labelId: LABEL_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.cardLabelAssignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cardId_labelId: { cardId: CARD_ID, labelId: LABEL_ID } },
        }),
      );
    });

    it("ADD_LABEL: edge — labelId not configured → upsert NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "ADD_LABEL" /* no labelId */ }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.cardLabelAssignment.upsert).not.toHaveBeenCalled();
    });

    it("REMOVE_LABEL: calls deleteMany with correct where clause", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "REMOVE_LABEL", labelId: LABEL_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.cardLabelAssignment.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { cardId: CARD_ID, labelId: LABEL_ID } }),
      );
    });

    it("REMOVE_LABEL: edge — labelId not configured → deleteMany NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "REMOVE_LABEL" /* no labelId */ }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.cardLabelAssignment.deleteMany).not.toHaveBeenCalled();
    });
  });

  // ─── 7.15 Action: POST_COMMENT ───────────────────────────────────────────────

  describe("7.15 Action: POST_COMMENT", () => {
    const originalSystemUser = process.env.SYSTEM_USER_ID;

    afterEach(() => {
      if (originalSystemUser === undefined) {
        delete process.env.SYSTEM_USER_ID;
      } else {
        process.env.SYSTEM_USER_ID = originalSystemUser;
      }
    });

    it("should create a comment authored by SYSTEM_USER_ID when configured", async () => {
      process.env.SYSTEM_USER_ID = SYSTEM_USER;
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "POST_COMMENT", comment: "Auto-tagged by rule." }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.comment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            text:   "Auto-tagged by rule.",
            cardId: CARD_ID,
            userId: SYSTEM_USER,
          }),
        }),
      );
    });

    it("should skip comment creation when SYSTEM_USER_ID is not set", async () => {
      delete process.env.SYSTEM_USER_ID;
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "POST_COMMENT", comment: "Should not appear." }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    it("edge: action.comment is not set → comment.create NOT called even with SYSTEM_USER_ID", async () => {
      process.env.SYSTEM_USER_ID = SYSTEM_USER;
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "POST_COMMENT" /* no comment */ }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.comment.create).not.toHaveBeenCalled();
    });
  });

  // ─── 7.16 Action: SEND_NOTIFICATION ──────────────────────────────────────────

  describe("7.16 Action: SEND_NOTIFICATION", () => {
    const originalSystemUser = process.env.SYSTEM_USER_ID;

    afterEach(() => {
      if (originalSystemUser === undefined) {
        delete process.env.SYSTEM_USER_ID;
      } else {
        process.env.SYSTEM_USER_ID = originalSystemUser;
      }
    });

    it("should create a notification when SYSTEM_USER_ID is set and card has an assignee", async () => {
      process.env.SYSTEM_USER_ID = SYSTEM_USER;
      setupDefaultMocks({ assigneeId: ASSIGNEE_ID });
      (db.user.findUnique as jest.Mock).mockResolvedValue({ id: ASSIGNEE_ID, name: "Alice" });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [
          { type: "SEND_NOTIFICATION", notificationMessage: "Card updated automatically." },
        ]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orgId:   ORG_ID,
            userId:  ASSIGNEE_ID,
            actorId: SYSTEM_USER,
            title:   "Card updated automatically.",
          }),
        }),
      );
    });

    it("should skip notification when card has no assignee", async () => {
      process.env.SYSTEM_USER_ID = SYSTEM_USER;
      setupDefaultMocks({ assigneeId: null });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [
          { type: "SEND_NOTIFICATION", notificationMessage: "Should not send." },
        ]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it("should skip notification when SYSTEM_USER_ID is not configured", async () => {
      delete process.env.SYSTEM_USER_ID;
      setupDefaultMocks({ assigneeId: ASSIGNEE_ID });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [
          { type: "SEND_NOTIFICATION", notificationMessage: "Should not send." },
        ]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it("should skip notification when action.notificationMessage is not set", async () => {
      process.env.SYSTEM_USER_ID = SYSTEM_USER;
      setupDefaultMocks({ assigneeId: ASSIGNEE_ID });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [
          { type: "SEND_NOTIFICATION" /* no notificationMessage */ },
        ]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.notification.create).not.toHaveBeenCalled();
    });
  });

  // ─── 7.17 Action: COMPLETE_CHECKLIST ─────────────────────────────────────────

  describe("7.17 Action: COMPLETE_CHECKLIST", () => {
    it("should call checklistItem.updateMany to mark all items complete", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "COMPLETE_CHECKLIST", checklistId: CHECKLIST_ID }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.checklistItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ checklistId: CHECKLIST_ID }),
          data:  { isComplete: true },
        }),
      );
    });

    it("should target a specific item when action.itemId is provided", async () => {
      const ITEM_ID = "77777777-7777-4777-8777-777777777777";
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [
          { type: "COMPLETE_CHECKLIST", checklistId: CHECKLIST_ID, itemId: ITEM_ID },
        ]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.checklistItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ checklistId: CHECKLIST_ID, id: ITEM_ID }),
        }),
      );
    });

    it("edge: no checklistId configured → updateMany NOT called", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "COMPLETE_CHECKLIST" /* no checklistId */ }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.checklistItem.updateMany).not.toHaveBeenCalled();
    });
  });

  // ─── 7.18 Logging & Run-Count ────────────────────────────────────────────────

  describe("7.18 Logging & Run-Count", () => {
    it("should write AutomationLog with success=true when action completes", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "LOW" }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ automationId: AUTOMATION_ID, success: true }),
        }),
      );
    });

    it("should write AutomationLog with success=false and error message when action throws", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      (db.card.update as jest.Mock).mockRejectedValueOnce(new Error("DB constraint violated"));
      await runAutomations(BASE_EVENT);
      expect(db.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            success: false,
            error:   "DB constraint violated",
          }),
        }),
      );
    });

    it("should increment automation.runCount and set lastRunAt on success", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "LOW" }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.automation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ runCount: { increment: 1 } }),
        }),
      );
    });

    it("should NOT increment automation.runCount when action throws", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "HIGH" }]),
      ]);
      (db.card.update as jest.Mock).mockRejectedValueOnce(new Error("Failure"));
      await runAutomations(BASE_EVENT);
      expect(db.automation.update).not.toHaveBeenCalled();
    });

    it("should include the automationId in the log record", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "LOW" }]),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.automationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ automationId: AUTOMATION_ID, cardId: CARD_ID }),
        }),
      );
    });
  });

  // ─── 7.19 Conditions Gate ────────────────────────────────────────────────────

  describe("7.19 Conditions Gate", () => {
    it("should execute action when condition is met (priority eq HIGH → card IS HIGH)", async () => {
      setupDefaultMocks({ priority: "HIGH" });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation(
          "CARD_CREATED",
          [{ type: "ASSIGN_MEMBER", assigneeId: ASSIGNEE_ID }],
          {},
          [{ field: "priority", op: "eq", value: "HIGH" }],
        ),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).toHaveBeenCalled();
    });

    it("should skip action when condition is NOT met (priority eq HIGH but card is MEDIUM)", async () => {
      setupDefaultMocks({ priority: "MEDIUM" });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation(
          "CARD_CREATED",
          [{ type: "ASSIGN_MEMBER", assigneeId: ASSIGNEE_ID }],
          {},
          [{ field: "priority", op: "eq", value: "HIGH" }],
        ),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("should execute action when condition uses is_null on a null field (dueDate)", async () => {
      setupDefaultMocks({ dueDate: null });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation(
          "CARD_CREATED",
          [{ type: "SET_PRIORITY", priority: "LOW" }],
          {},
          [{ field: "dueDate", op: "is_null" }],
        ),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).toHaveBeenCalled();
    });

    it("should skip action when condition uses is_not_null on a null field (dueDate)", async () => {
      setupDefaultMocks({ dueDate: null });
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation(
          "CARD_CREATED",
          [{ type: "SET_PRIORITY", priority: "LOW" }],
          {},
          [{ field: "dueDate", op: "is_not_null" }],
        ),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("should skip when condition has an unknown op (fail-safe behavior)", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation(
          "CARD_CREATED",
          [{ type: "SET_PRIORITY", priority: "LOW" }],
          {},
          [{ field: "priority", op: "UNKNOWN_OP", value: "HIGH" }],
        ),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).not.toHaveBeenCalled();
    });

    it("empty conditions array always passes — no conditions means always run", async () => {
      (db.automation.findMany as jest.Mock).mockResolvedValue([
        makeAutomation("CARD_CREATED", [{ type: "SET_PRIORITY", priority: "LOW" }], {}, []),
      ]);
      await runAutomations(BASE_EVENT);
      expect(db.card.update).toHaveBeenCalled();
    });
  });
});
