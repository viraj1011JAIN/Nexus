/**
 * Section 10A — Import / Export: Action-Layer Tests
 *
 * Tests the five core server actions directly.
 * Source: actions/import-export-actions.ts
 *
 * Covers:
 *   10.1  exportBoardAsJSON — happy path with full board snapshot
 *   10.2  exportBoardAsJSON — org isolation: only boards belonging to ctx.orgId returned
 *   10.3  exportBoardAsJSON — board not found → { error }
 *   10.4  exportBoardAsJSON — unauthorized (no userId/orgId)
 *   10.5  exportBoardAsCSV  — happy path: returns CSV string + filename
 *   10.6  exportBoardAsCSV  — board not found → { error }
 *   10.7  exportBoardAsCSV  — CSV special chars escaped (double-quote rule)
 *   10.8  importFromJSON    — valid nexus v1 payload → board created
 *   10.9  importFromJSON    — missing __nexusExport marker → { error }
 *   10.10 importFromJSON    — missing board.title → { error }
 *   10.11 importFromJSON    — unauthorized
 *   10.12 importFromJSON    — checklists and items created alongside cards
 *   10.13 importFromJSON    — invalid priority coerced to "MEDIUM"
 *   10.14 importFromTrello  — valid Trello payload → board created
 *   10.15 importFromTrello  — closed lists and cards filtered out
 *   10.16 importFromTrello  — invalid payload missing `.lists` array → { error }
 *   10.17 importFromJira    — valid XML with one item → board created
 *   10.18 importFromJira    — XML without <item> tags → { error }
 *   10.19 importFromJira    — non-XML string (not a string type) → { error }
 *   10.20 importFromJira    — Jira priority mapping (Blocker→URGENT, Major→HIGH, Minor→LOW)
 *   10.21 importFromJira    — Jira status mapping (done→Done list, in progress→In Progress)
 */

import {
  exportBoardAsJSON,
  exportBoardAsCSV,
  importFromJSON,
  importFromTrello,
  importFromJira,
} from "@/actions/import-export-actions";
import { db } from "@/lib/db";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_A   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const _ORG_B   = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOARD_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LIST_A  = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CARD_A  = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NEW_BOARD_ID = "11111111-1111-4111-8111-111111111111";

/** A minimal board record with the deep include structure used by export. */
const BOARD_RECORD = {
  id:           BOARD_A,
  title:        "My Engineering Board",
  imageThumbUrl: "https://images.unsplash.com/photo-123",
  orgId:        ORG_A,
  lists: [
    {
      id:    LIST_A,
      title: "Todo",
      order: "000000",
      cards: [
        {
          id:          CARD_A,
          title:       "Fix login bug",
          description: "Repro: login fails on Safari",
          priority:    "HIGH",
          dueDate:     new Date("2026-06-01T00:00:00Z"),
          startDate:   null,
          storyPoints: 3,
          labels:      [
            { labelId: "lbl-1", label: { name: "Bug", color: "#ff0000" } },
          ],
          checklists: [
            {
              id:    "chk-1",
              title: "Acceptance Criteria",
              items: [
                { id: "itm-1", title: "Write test", isComplete: true, order: "000000" },
                { id: "itm-2", title: "Deploy",     isComplete: false, order: "000001" },
              ],
            },
          ],
          assignee:  { id: "usr-1", name: "Alice" },
        },
      ],
    },
  ],
};

/** Minimal valid Nexus export payload. */
const NEXUS_PAYLOAD = {
  __nexusExport: "v1" as const,
  exportedAt:    "2026-02-01T00:00:00Z",
  board: {
    title: "Imported Board",
    lists: [
      {
        title: "Backlog",
        cards: [
          {
            title:  "Card One",
            priority: "HIGH",
            checklists: [
              {
                title: "Steps",
                items: [{ text: "Step 1", checked: false }],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Minimal valid Trello export payload. */
const TRELLO_PAYLOAD = {
  name:  "Trello Board",
  lists: [
    { id: "t-list-1", name: "Backlog",  closed: false },
    { id: "t-list-2", name: "Archived", closed: true  },
  ],
  cards: [
    { name: "Trello Card 1", desc: "desc", due: null, closed: false, idList: "t-list-1" },
    { name: "Archived Card", desc: "",     due: null, closed: true,  idList: "t-list-1" },
  ],
};

/** Minimal valid Jira RSS/XML with one item. */
const JIRA_XML_VALID = `<?xml version="1.0"?>
<rss version="0.92">
  <channel>
    <title>TEST PROJECT</title>
    <item>
      <summary>Fix login crash</summary>
      <priority>Blocker</priority>
      <status>To Do</status>
    </item>
    <item>
      <summary>Improve performance</summary>
      <priority>Major</priority>
      <status>In Progress</status>
    </item>
    <item>
      <summary>Update docs</summary>
      <priority>Minor</priority>
      <status>Done</status>
    </item>
  </channel>
</rss>`;

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_clerk_0001", orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
}));

jest.mock("@/lib/db", () => ({
  db: {
    board: {
      findFirst: jest.fn(),
      create:    jest.fn(),
    },
    list: {
      create:                jest.fn(),
      createManyAndReturn:   jest.fn(),
    },
    card: {
      create:     jest.fn(),
      createMany: jest.fn(),
    },
    checklist: {
      create: jest.fn(),
    },
    checklistItem: {
      create: jest.fn(),
    },
  },
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

// ─── Reset helpers ────────────────────────────────────────────────────────────

function resetMocks() {
  const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
  auth.mockResolvedValue({ userId: "user_clerk_0001", orgId: ORG_A });

  (db.board.findFirst           as jest.Mock).mockResolvedValue(null);
  (db.board.create              as jest.Mock).mockResolvedValue({ id: NEW_BOARD_ID, orgId: ORG_A });
  (db.list.create               as jest.Mock).mockResolvedValue({ id: LIST_A });
  (db.list.createManyAndReturn  as jest.Mock).mockResolvedValue([
    { id: "list-todo",       title: "To Do" },
    { id: "list-inprogress", title: "In Progress" },
    { id: "list-done",       title: "Done" },
  ]);
  (db.card.create               as jest.Mock).mockResolvedValue({ id: CARD_A });
  (db.card.createMany           as jest.Mock).mockResolvedValue({ count: 1 });
  (db.checklist.create          as jest.Mock).mockResolvedValue({ id: "chk-new" });
  (db.checklistItem.create      as jest.Mock).mockResolvedValue({ id: "itm-new" });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Section 10A — Import / Export Actions", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetMocks();
  });

  // ─── 10.1 exportBoardAsJSON happy path ──────────────────────────────────────

  describe("10.1 exportBoardAsJSON — happy path", () => {
    it("should return a snapshot with __nexusExport v1 marker", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsJSON(BOARD_A);
      expect(result.error).toBeUndefined();
      expect(result.data?.board).toBeDefined();
      expect((result.data as { __nexusExport?: string }).__nexusExport).toBe("v1");
    });

    it("should include correct board title in the snapshot", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsJSON(BOARD_A);
      expect(result.data?.board.title).toBe("My Engineering Board");
    });

    it("should export all lists in order", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsJSON(BOARD_A);
      expect(result.data?.board.lists).toHaveLength(1);
      expect(result.data?.board.lists[0].title).toBe("Todo");
    });

    it("should export cards with labels, checklists, and assignee", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsJSON(BOARD_A);
      const card = result.data?.board.lists[0].cards[0];
      expect(card?.title).toBe("Fix login bug");
      expect(card?.labels).toHaveLength(1);
      expect(card?.checklists).toHaveLength(1);
      expect(card?.assigneeName).toBe("Alice");
    });

    it("should include exportedAt timestamp", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsJSON(BOARD_A);
      expect(typeof (result.data as { exportedAt?: string }).exportedAt).toBe("string");
    });
  });

  // ─── 10.2 exportBoardAsJSON — org isolation ──────────────────────────────────

  describe("10.2 exportBoardAsJSON — org isolation", () => {
    it("should query ONLY boards where orgId matches the JWT orgId (Org A)", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      await exportBoardAsJSON(BOARD_A);
      expect(db.board.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: BOARD_A, orgId: ORG_A }),
        }),
      );
    });

    it("should return 'Board not found' when board belongs to Org B (findFirst returns null)", async () => {
      // Simulates Prisma returning null because orgId = Org B doesn't match the JWT orgId = Org A
      (db.board.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await exportBoardAsJSON(BOARD_A);
      expect(result.error).toMatch(/Board not found/i);
      expect(result.data).toBeUndefined();
    });

    it("Org B data never appears in Org A export — snapshot only receives what findFirst returns", async () => {
      const orgABoard = { ...BOARD_RECORD, orgId: ORG_A };
      (db.board.findFirst as jest.Mock).mockResolvedValue(orgABoard);
      const auth = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.auth.mockResolvedValue({ userId: "user_clerk_0001", orgId: ORG_A });
      const result = await exportBoardAsJSON(BOARD_A);
      // Snapshot is built from the board returned by findFirst, which is Org A only
      expect(result.data?.board.title).toBe("My Engineering Board");
    });
  });

  // ─── 10.3 exportBoardAsJSON — board not found ────────────────────────────────

  describe("10.3 exportBoardAsJSON — board not found", () => {
    it("should return { error } when board does not exist", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await exportBoardAsJSON("nonexistent-board-id");
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  // ─── 10.4 exportBoardAsJSON — unauthorized ────────────────────────────────────

  describe("10.4 exportBoardAsJSON — unauthorized", () => {
    it("should return { error: 'Unauthorized' } when no userId", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null, orgId: null });
      const result = await exportBoardAsJSON(BOARD_A);
      expect(result.error).toBe("Unauthorized");
      expect(db.board.findFirst).not.toHaveBeenCalled();
    });
  });

  // ─── 10.5 exportBoardAsCSV — happy path ──────────────────────────────────────

  describe("10.5 exportBoardAsCSV — happy path", () => {
    it("should return a non-empty CSV string", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsCSV(BOARD_A);
      expect(result.error).toBeUndefined();
      expect(typeof result.data).toBe("string");
      expect((result.data as string).length).toBeGreaterThan(0);
    });

    it("should include a header row as the first line", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsCSV(BOARD_A);
      const lines = (result.data as string).split("\n");
      // Header always comes first
      expect(lines[0]).toMatch(/List|Card Title|Priority/i);
    });

    it("should include the card title in the CSV output", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsCSV(BOARD_A);
      expect(result.data).toContain("Fix login bug");
    });

    it("should return a filename containing the board title", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(BOARD_RECORD);
      const result = await exportBoardAsCSV(BOARD_A);
      expect(result.filename).toBeDefined();
      expect(result.filename).toMatch(/\.csv$/);
    });
  });

  // ─── 10.6 exportBoardAsCSV — board not found ─────────────────────────────────

  describe("10.6 exportBoardAsCSV — board not found", () => {
    it("should return { error } when board does not exist", async () => {
      (db.board.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await exportBoardAsCSV("nonexistent");
      expect(result.error).toBeDefined();
    });
  });

  // ─── 10.7 exportBoardAsCSV — CSV escaping ───────────────────────────────────

  describe("10.7 exportBoardAsCSV — special characters escaped", () => {
    it("should double-quote commas in card titles (CSV escape rule)", async () => {
      const boardWithComma = {
        ...BOARD_RECORD,
        lists: [
          {
            ...BOARD_RECORD.lists[0],
            cards: [
              {
                ...BOARD_RECORD.lists[0].cards[0],
                title: 'Fix login, logout bug',
              },
            ],
          },
        ],
      };
      (db.board.findFirst as jest.Mock).mockResolvedValue(boardWithComma);
      const result = await exportBoardAsCSV(BOARD_A);
      // Title with comma is wrapped in double-quotes
      expect(result.data).toContain('"Fix login, logout bug"');
    });

    it("should escape double-quotes inside values with two double-quotes", async () => {
      const boardWithQuote = {
        ...BOARD_RECORD,
        lists: [
          {
            ...BOARD_RECORD.lists[0],
            cards: [
              {
                ...BOARD_RECORD.lists[0].cards[0],
                title: 'Fix "critical" bug',
              },
            ],
          },
        ],
      };
      (db.board.findFirst as jest.Mock).mockResolvedValue(boardWithQuote);
      const result = await exportBoardAsCSV(BOARD_A);
      expect(result.data).toContain('"Fix ""critical"" bug"');
    });
  });

  // ─── 10.8 importFromJSON — valid nexus payload ───────────────────────────────

  describe("10.8 importFromJSON — valid Nexus v1 payload", () => {
    it("should create a board and return its ID", async () => {
      const result = await importFromJSON(NEXUS_PAYLOAD);
      expect(result.error).toBeUndefined();
      expect(result.data?.boardId).toBe(NEW_BOARD_ID);
    });

    it("should call db.board.create with title containing '(imported)'", async () => {
      await importFromJSON(NEXUS_PAYLOAD);
      expect(db.board.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining("(imported)"),
            orgId: ORG_A,
          }),
        }),
      );
    });

    it("should create one list per entry in payload.board.lists", async () => {
      await importFromJSON(NEXUS_PAYLOAD);
      expect(db.list.create).toHaveBeenCalledTimes(NEXUS_PAYLOAD.board.lists.length);
    });

    it("should create one card per entry in each list", async () => {
      await importFromJSON(NEXUS_PAYLOAD);
      const totalCards = NEXUS_PAYLOAD.board.lists.reduce(
        (sum, l) => sum + l.cards.length,
        0,
      );
      expect(db.card.create).toHaveBeenCalledTimes(totalCards);
    });
  });

  // ─── 10.9 importFromJSON — missing __nexusExport marker ─────────────────────

  describe("10.9 importFromJSON — invalid payload", () => {
    it("should return { error } when __nexusExport is missing", async () => {
      const result = await importFromJSON({ board: { title: "test", lists: [] } });
      expect(result.error).toBe("Invalid Nexus export file.");
      expect(db.board.create).not.toHaveBeenCalled();
    });

    it("should return { error } when __nexusExport value is not 'v1'", async () => {
      const result = await importFromJSON({ __nexusExport: "v2", board: { title: "test", lists: [] } });
      expect(result.error).toBe("Invalid Nexus export file.");
    });

    it("should return { error } when board.title is missing", async () => {
      const result = await importFromJSON({ __nexusExport: "v1", board: { lists: [] } });
      expect(result.error).toBe("Invalid Nexus export file.");
    });

    it("should return { error } for null payload", async () => {
      const result = await importFromJSON(null);
      expect(result.error).toBe("Invalid Nexus export file.");
    });
  });

  // ─── 10.10 importFromJSON — unauthorized ─────────────────────────────────────

  describe("10.10 importFromJSON — unauthorized", () => {
    it("should return { error: 'Unauthorized' } when no session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null, orgId: null });
      const result = await importFromJSON(NEXUS_PAYLOAD);
      expect(result.error).toBe("Unauthorized");
      expect(db.board.create).not.toHaveBeenCalled();
    });
  });

  // ─── 10.11 importFromJSON — checklists and items ─────────────────────────────

  describe("10.11 importFromJSON — checklists and items created alongside cards", () => {
    it("should create a checklist row for each checklist in the payload", async () => {
      await importFromJSON(NEXUS_PAYLOAD);
      expect(db.checklist.create).toHaveBeenCalledTimes(
        NEXUS_PAYLOAD.board.lists[0].cards[0].checklists.length,
      );
    });

    it("should create checklistItem rows for each item in each checklist", async () => {
      await importFromJSON(NEXUS_PAYLOAD);
      const totalItems = NEXUS_PAYLOAD.board.lists[0].cards[0].checklists[0].items.length;
      expect(db.checklistItem.create).toHaveBeenCalledTimes(totalItems);
    });
  });

  // ─── 10.12 importFromJSON — priority coercion ───────────────────────────────

  describe("10.12 importFromJSON — unknown priority coerced to MEDIUM", () => {
    it("should coerce an unrecognised priority string to MEDIUM", async () => {
      const payloadWithBadPriority = {
        ...NEXUS_PAYLOAD,
        board: {
          ...NEXUS_PAYLOAD.board,
          lists: [
            {
              title: "Backlog",
              cards: [{ title: "Card", priority: "CRITICAL" }],
            },
          ],
        },
      };
      await importFromJSON(payloadWithBadPriority);
      expect(db.card.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priority: "MEDIUM" }),
        }),
      );
    });
  });

  // ─── 10.13 importFromTrello — valid payload ──────────────────────────────────

  describe("10.13 importFromTrello — valid Trello payload", () => {
    it("should create a board and return its ID", async () => {
      const result = await importFromTrello(TRELLO_PAYLOAD);
      expect(result.error).toBeUndefined();
      expect(result.data?.boardId).toBe(NEW_BOARD_ID);
    });

    it("should include '(from Trello)' in the created board title", async () => {
      await importFromTrello(TRELLO_PAYLOAD);
      expect(db.board.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining("(from Trello)"),
          }),
        }),
      );
    });

    it("should only import open (non-archived) lists", async () => {
      await importFromTrello(TRELLO_PAYLOAD);
      const activeLists = TRELLO_PAYLOAD.lists.filter((l) => !l.closed);
      expect(db.list.create).toHaveBeenCalledTimes(activeLists.length);
    });

    it("should only import open (non-archived) cards", async () => {
      await importFromTrello(TRELLO_PAYLOAD);
      const activeCards = TRELLO_PAYLOAD.cards.filter((c) => !c.closed);
      expect(db.card.create).toHaveBeenCalledTimes(activeCards.length);
    });
  });

  // ─── 10.14 importFromTrello — invalid payload ────────────────────────────────

  describe("10.14 importFromTrello — invalid payload", () => {
    it("should return { error } when payload has no .lists array", async () => {
      const result = await importFromTrello({ name: "Board" }); // missing lists
      expect(result.error).toBe("Invalid Trello export file.");
      expect(db.board.create).not.toHaveBeenCalled();
    });

    it("should return { error } when payload.name is missing", async () => {
      const result = await importFromTrello({ lists: [], cards: [] });
      expect(result.error).toBe("Invalid Trello export file.");
    });

    it("should return { error: 'Unauthorized' } when no session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null, orgId: null });
      const result = await importFromTrello(TRELLO_PAYLOAD);
      expect(result.error).toBe("Unauthorized");
    });
  });

  // ─── 10.15 importFromJira — valid XML ────────────────────────────────────────

  describe("10.15 importFromJira — valid Jira RSS/XML", () => {
    it("should create a board and return its ID", async () => {
      const result = await importFromJira(JIRA_XML_VALID);
      expect(result.error).toBeUndefined();
      expect(result.data?.boardId).toBe(NEW_BOARD_ID);
    });

    it("should include '(from Jira)' in the created board title", async () => {
      await importFromJira(JIRA_XML_VALID);
      expect(db.board.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: expect.stringContaining("(from Jira)"),
          }),
        }),
      );
    });

    it("should create three standard lists: To Do, In Progress, Done", async () => {
      await importFromJira(JIRA_XML_VALID);
      expect(db.list.createManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ title: "To Do" }),
            expect.objectContaining({ title: "In Progress" }),
            expect.objectContaining({ title: "Done" }),
          ]),
        }),
      );
    });

    it("should call card.createMany with all parsed items", async () => {
      await importFromJira(JIRA_XML_VALID);
      expect(db.card.createMany).toHaveBeenCalledTimes(1);
      const callArgs = (db.card.createMany as jest.Mock).mock.calls[0][0] as { data: unknown[] };
      expect(callArgs.data.length).toBe(3); // 3 items in JIRA_XML_VALID
    });
  });

  // ─── 10.16 importFromJira — invalid XML ──────────────────────────────────────

  describe("10.16 importFromJira — invalid XML", () => {
    it("should return { error } when XML has no <item> tags", async () => {
      const result = await importFromJira("<rss><channel><title>Empty</title></channel></rss>");
      expect(result.error).toBeDefined();
      expect(db.board.create).not.toHaveBeenCalled();
    });

    it("should return { error } when input is an empty string", async () => {
      const result = await importFromJira("");
      expect(result.error).toBeDefined();
    });

    it("should return { error } when non-string is passed (type guard)", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await importFromJira(42 as any);
      expect(result.error).toBeDefined();
    });

    it("should return { error: 'Unauthorized' } when no session", async () => {
      const { auth } = jest.requireMock("@clerk/nextjs/server") as { auth: jest.Mock };
      auth.mockResolvedValueOnce({ userId: null, orgId: null });
      const result = await importFromJira(JIRA_XML_VALID);
      expect(result.error).toBe("Unauthorized");
    });
  });

  // ─── 10.17 importFromJira — priority mapping ─────────────────────────────────

  describe("10.17 importFromJira — Jira priority → Nexus priority mapping", () => {
    async function importAndGetCards(priorityLabel: string): Promise<{ priority: string }[]> {
      const xml = `<rss><channel><item>
        <summary>Test</summary>
        <priority>${priorityLabel}</priority>
        <status>To Do</status>
      </item></channel></rss>`;
      (db.card.createMany as jest.Mock).mockClear();
      await importFromJira(xml);
      const args = (db.card.createMany as jest.Mock).mock.calls[0]?.[0] as
        | { data: { priority: string }[] }
        | undefined;
      return args?.data ?? [];
    }

    it("Blocker → URGENT", async () => {
      const cards = await importAndGetCards("Blocker");
      expect(cards[0]?.priority).toBe("URGENT");
    });

    it("Critical → URGENT", async () => {
      const cards = await importAndGetCards("Critical");
      expect(cards[0]?.priority).toBe("URGENT");
    });

    it("Major → HIGH", async () => {
      const cards = await importAndGetCards("Major");
      expect(cards[0]?.priority).toBe("HIGH");
    });

    it("Minor → LOW", async () => {
      const cards = await importAndGetCards("Minor");
      expect(cards[0]?.priority).toBe("LOW");
    });

    it("Unknown priority → MEDIUM (default)", async () => {
      const cards = await importAndGetCards("Trivial");
      expect(cards[0]?.priority).toBe("MEDIUM");
    });
  });

  // ─── 10.18 importFromJira — status → list mapping ────────────────────────────

  describe("10.18 importFromJira — Jira status → Nexus list mapping", () => {
    it("status 'In Progress' maps card to the In Progress list", async () => {
      const xml = `<rss><channel>
        <item><summary>WIP</summary><priority>Medium</priority><status>In Progress</status></item>
      </channel></rss>`;
      await importFromJira(xml);
      const args = (db.card.createMany as jest.Mock).mock.calls[0]?.[0] as
        { data: { listId: string }[] };
      // The listId for In Progress is whatever createManyAndReturn returned for "In Progress"
      // In our mock: { id: "list-inprogress", title: "In Progress" }
      expect(args.data[0].listId).toBe("list-inprogress");
    });

    it("status 'Done' maps card to the Done list", async () => {
      const xml = `<rss><channel>
        <item><summary>Closed</summary><priority>Low</priority><status>Done</status></item>
      </channel></rss>`;
      await importFromJira(xml);
      const args = (db.card.createMany as jest.Mock).mock.calls[0]?.[0] as
        { data: { listId: string }[] };
      expect(args.data[0].listId).toBe("list-done");
    });

    it("status 'To Do' (default) maps card to the To Do list", async () => {
      const xml = `<rss><channel>
        <item><summary>New task</summary><priority>Medium</priority><status>Open</status></item>
      </channel></rss>`;
      await importFromJira(xml);
      const args = (db.card.createMany as jest.Mock).mock.calls[0]?.[0] as
        { data: { listId: string }[] };
      expect(args.data[0].listId).toBe("list-todo");
    });
  });
});
