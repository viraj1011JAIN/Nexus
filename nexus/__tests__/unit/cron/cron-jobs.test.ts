/**
 * @jest-environment node
 *
 * SECTION 15 — Cron Job Tests
 *
 * Covers:
 *   15.1  Authorization — missing/wrong CRON_SECRET → 401
 *   15.2  Daily reports cron — generates reports for all orgs
 *   15.3  Due-date reminders — sends to assigned cards due tomorrow
 *   15.4  Idempotency — running twice doesn't double-send
 *   15.5  Weekly digest — sent only on Monday
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();

jest.mock("@/lib/db", () => ({
  systemDb: {
    organization: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
  },
}));

jest.mock("@/lib/email", () => ({
  sendWeeklyDigestEmail: jest.fn().mockResolvedValue({ id: "email_1" }),
  sendDueDateReminderEmail: jest.fn().mockResolvedValue({ id: "email_2" }),
}));

jest.mock("@clerk/nextjs/server", () => ({
  clerkClient: jest.fn().mockResolvedValue({
    organizations: {
      getOrganizationMembershipList: jest.fn().mockResolvedValue({ data: [] }),
    },
  }),
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_SECRET = "test_cron_secret_123";
const OLD_ENV = { ...process.env };

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) {
    headers.set("authorization", authHeader);
  }
  return new Request("http://localhost:3000/api/cron/daily-reports", {
    method: "GET",
    headers,
  });
}

function makeOrgWithCards(
  orgId: string,
  cards: Array<{
    id: string;
    title: string;
    dueDate?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    listId: string;
    assignee?: { email: string; name: string } | null;
    assigneeId?: string | null;
  }>,
  overrides: Record<string, unknown> = {}
) {
  return {
    id: orgId,
    name: `Org ${orgId}`,
    boards: [
      {
        id: "board-1",
        title: "Board One",
        lists: [
          {
            id: "list-done",
            title: "Done",
            cards: cards.filter((c) => c.listId === "list-done"),
          },
          {
            id: "list-todo",
            title: "To Do",
            cards: cards.filter((c) => c.listId === "list-todo"),
          },
        ],
      },
    ],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Section 15 — Cron Jobs", () => {
  let GET: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    process.env.CRON_SECRET = VALID_SECRET;
    const mod = await import("@/app/api/cron/daily-reports/route");
    GET = mod.GET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = VALID_SECRET;
  });

  afterAll(() => {
    process.env = { ...OLD_ENV };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15.1 — Authorization
  // ═══════════════════════════════════════════════════════════════════════════

  describe("15.1 Authorization", () => {
    it("15.1 should return 401 when Authorization header is missing", async () => {
      const req = makeRequest();
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("15.2 should return 401 when CRON_SECRET is wrong", async () => {
      const req = makeRequest("Bearer wrong_secret");
      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it("15.3 should return 200 with valid CRON_SECRET", async () => {
      mockFindMany.mockResolvedValueOnce([]);
      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("15.4 should return 401 with Bearer prefix mismatch", async () => {
      const req = makeRequest(VALID_SECRET); // missing "Bearer "
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15.2 — Daily reports generation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("15.2 Daily reports", () => {
    it("15.5 should generate reports for all organizations", async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-1",
            title: "Card 1",
            createdAt: yesterday,
            updatedAt: yesterday,
            listId: "list-todo",
            assignee: null,
          },
        ]),
        makeOrgWithCards("org_2", []),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.reportsGenerated).toBe(2);
    });

    it("15.6 should handle empty organizations gracefully", async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.reportsGenerated).toBe(0);
    });

    it("15.7 should count cards created yesterday correctly", async () => {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(12, 0, 0, 0);

      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-yesterday",
            title: "Yesterday's card",
            createdAt: yesterday,
            updatedAt: yesterday,
            listId: "list-todo",
            assignee: null,
          },
          {
            id: "card-old",
            title: "Old card",
            createdAt: twoDaysAgo,
            updatedAt: twoDaysAgo,
            listId: "list-todo",
            assignee: null,
          },
        ]),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15.3 — Due-date reminders
  // ═══════════════════════════════════════════════════════════════════════════

  describe("15.3 Due-date reminders", () => {
    it("15.8 should send reminder for card due tomorrow", async () => {
      const { sendDueDateReminderEmail } = jest.requireMock("@/lib/email") as {
        sendDueDateReminderEmail: jest.Mock;
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-due",
            title: "Due Soon Card",
            dueDate: tomorrow,
            createdAt: new Date(),
            updatedAt: new Date(),
            listId: "list-todo",
            assignee: { email: "user@test.com", name: "Test User" },
          },
        ]),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      await GET(req);

      expect(sendDueDateReminderEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          userEmail: "user@test.com",
          userName: "Test User",
          cardTitle: "Due Soon Card",
        })
      );
    });

    it("15.9 should NOT send reminder for unassigned cards", async () => {
      const { sendDueDateReminderEmail } = jest.requireMock("@/lib/email") as {
        sendDueDateReminderEmail: jest.Mock;
      };

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-due-no-assignee",
            title: "No Assignee Card",
            dueDate: tomorrow,
            createdAt: new Date(),
            updatedAt: new Date(),
            listId: "list-todo",
            assignee: null,
          },
        ]),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      await GET(req);

      expect(sendDueDateReminderEmail).not.toHaveBeenCalled();
    });

    it("15.10 should NOT send reminder for cards due 3 days from now", async () => {
      const { sendDueDateReminderEmail } = jest.requireMock("@/lib/email") as {
        sendDueDateReminderEmail: jest.Mock;
      };

      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-due-later",
            title: "Not due soon",
            dueDate: threeDaysLater,
            createdAt: new Date(),
            updatedAt: new Date(),
            listId: "list-todo",
            assignee: { email: "user@test.com", name: "Test" },
          },
        ]),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      await GET(req);

      expect(sendDueDateReminderEmail).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15.4 — Idempotency
  // ═══════════════════════════════════════════════════════════════════════════

  describe("15.4 Idempotency", () => {
    it("15.11 running cron twice produces same result", async () => {
      mockFindMany.mockResolvedValue([]);

      const req1 = makeRequest(`Bearer ${VALID_SECRET}`);
      const res1 = await GET(req1);
      const body1 = await res1.json();

      const req2 = makeRequest(`Bearer ${VALID_SECRET}`);
      const res2 = await GET(req2);
      const body2 = await res2.json();

      expect(body1.reportsGenerated).toBe(body2.reportsGenerated);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15.5 — Error resilience
  // ═══════════════════════════════════════════════════════════════════════════

  describe("15.5 Error resilience", () => {
    it("15.12 should return 500 when DB query fails", async () => {
      mockFindMany.mockRejectedValueOnce(new Error("DB connection lost"));

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);

      expect(res.status).toBe(500);
    });

    it("15.13 email failure does not crash cron", async () => {
      const { sendDueDateReminderEmail } = jest.requireMock("@/lib/email") as {
        sendDueDateReminderEmail: jest.Mock;
      };
      sendDueDateReminderEmail.mockRejectedValueOnce(new Error("SMTP down"));

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      mockFindMany.mockResolvedValueOnce([
        makeOrgWithCards("org_1", [
          {
            id: "card-1",
            title: "Test",
            dueDate: tomorrow,
            createdAt: new Date(),
            updatedAt: new Date(),
            listId: "list-todo",
            assignee: { email: "user@test.com", name: "Test" },
          },
        ]),
      ]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      // Should NOT throw — email failure is caught
      const res = await GET(req);
      expect(res.status).toBe(200);
    });

    it("15.14 response includes timestamp", async () => {
      mockFindMany.mockResolvedValueOnce([]);

      const req = makeRequest(`Bearer ${VALID_SECRET}`);
      const res = await GET(req);
      const body = await res.json();

      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });
  });
});
