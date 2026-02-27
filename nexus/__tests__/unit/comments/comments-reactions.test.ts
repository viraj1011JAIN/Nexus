/**
 * SECTION 6 — COMMENTS & REACTIONS TESTS
 *
 * Covers:
 *   6.1  createComment  — top-level, nested threading, orphan-parent rejection,
 *                         cross-org guard, input validation, rate-limit, drafts, mentions
 *   6.2  updateComment  — ownership, not-found, org boundary, rate-limit
 *   6.3  deleteComment  — ownership, not-found, cascade verification, rate-limit
 *   6.4  addReaction    — emoji validation regex, duplicate guard, cross-org guard,
 *                         rate-limit, reaction-count idempotency
 *   6.5  removeReaction — ownership, not-found, rate-limit
 *
 * Testing strategy:
 *   • All Prisma calls are mocked — no real DB hits.
 *   • Clerk User API (fetch) is mocked via jest.spyOn(global, "fetch").
 *   • createSafeAction wraps handlers, so:
 *       Zod errors  → { fieldErrors }  (never { error })
 *       TenantError → { error: "<safe message>" }
 *       throw Error → re-thrown (Next.js boundary catches in prod)
 *   • Rate limiter is mocked at the module level — no real in-memory state.
 */

import {
  createComment,
  updateComment,
  deleteComment,
  addReaction,
  removeReaction,
} from "@/actions/phase3-actions";
import { db } from "@/lib/db";

// ─── Fixture UUIDs (v4 format required by Zod .uuid()) ───────────────────────

const ORG_ID       = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG_ID = "11111111-1111-4111-8111-111111111111";
const BOARD_ID     = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CARD_ID      = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_CARD_ID= "22222222-2222-4222-8222-222222222222";
const COMMENT_ID   = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PARENT_ID    = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REACTION_ID  = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const USER_ID      = "user_clerk_0001";
const OTHER_USER_ID= "user_clerk_9999";

// ─── Helpers: factory fixtures ────────────────────────────────────────────────

const makeCard = (overrides: object = {}) => ({
  id: CARD_ID,
  title: "Test card",
  list: { board: { orgId: ORG_ID, title: "Test board" } },
  ...overrides,
});

const makeComment = (overrides: object = {}) => ({
  id: COMMENT_ID,
  text: "<p>Hello world</p>",
  cardId: CARD_ID,
  userId: USER_ID,
  userName: "Alice",
  userImage: null,
  parentId: null,
  mentions: [],
  isDraft: false,
  reactions: [],
  replies: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  card: {
    id: CARD_ID,
    title: "Test card",
    list: { board: { orgId: ORG_ID, title: "Test board" } },
  },
  ...overrides,
});

const makeReaction = (overrides: object = {}) => ({
  id: REACTION_ID,
  emoji: "👍",
  commentId: COMMENT_ID,
  userId: USER_ID,
  userName: "Alice",
  createdAt: new Date(),
  comment: {
    card: {
      list: { board: { orgId: ORG_ID } },
    },
  },
  ...overrides,
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId:     "user_clerk_0001",   // USER_ID — literal avoids TDZ in jest.mock factory
    orgId:      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", // ORG_ID
    orgRole:    "org:admin",
    membership: { role: "ADMIN", isActive: true },
  }),
  requireRole:   jest.fn().mockResolvedValue(undefined),
  isDemoContext: jest.fn().mockReturnValue(false),
  // Real TenantError class so instanceof checks work inside createSafeAction
  TenantError: jest.requireActual("@/lib/tenant-context").TenantError,
}));

jest.mock("@/lib/action-protection", () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 59, resetInMs: 60_000 }),
  RATE_LIMITS: {
    "create-comment": 60,
    "update-comment": 60,
    "delete-comment": 40,
    "add-reaction":   120,
    "remove-reaction":120,
  },
}));

jest.mock("@/lib/db", () => ({
  db: {
    card: {
      findUnique: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      delete:     jest.fn(),
    },
    commentReaction: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      create:     jest.fn(),
      delete:     jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/create-audit-log",  () => ({ createAuditLog: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/email",             () => ({ sendMentionEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/event-bus",         () => ({ emitCardEvent: jest.fn() }));
jest.mock("@/actions/notification-actions", () => ({ createNotification: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@clerk/nextjs/server",    () => ({ auth: jest.fn().mockResolvedValue({ userId: "user_clerk_0001", orgId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }) }));
jest.mock("next/cache",              () => ({ revalidatePath: jest.fn() }));
jest.mock("next/server",             () => ({ after: jest.fn((fn: () => void) => fn()) }));

// ─── Global fetch mock (Clerk User API) ──────────────────────────────────────

const CLERK_USER_RESPONSE = {
  id: USER_ID,
  firstName: "Alice",
  username:  "alice",
  imageUrl:  "https://img.clerk.com/alice.jpg",
};

// ─── Reset helpers ────────────────────────────────────────────────────────────

function resetMocks() {
  const m = jest.requireMock("@/lib/tenant-context") as { getTenantContext: jest.Mock };
  m.getTenantContext.mockResolvedValue({
    userId: USER_ID, orgId: ORG_ID,
    orgRole: "org:admin", membership: { role: "ADMIN", isActive: true },
  });

  const rl = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
  rl.checkRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetInMs: 60_000 });

  // Restore Promise-returning mocks so `.catch()` calls in the source don't throw TypeError.
  // resetAllMocks() strips implementations; these must be re-established each test.
  const em    = jest.requireMock("@/lib/email") as { sendMentionEmail: jest.Mock };
  em.sendMentionEmail.mockResolvedValue(undefined);

  const notif = jest.requireMock("@/actions/notification-actions") as { createNotification: jest.Mock };
  notif.createNotification.mockResolvedValue(undefined);

  const audit = jest.requireMock("@/lib/create-audit-log") as { createAuditLog: jest.Mock };
  audit.createAuditLog.mockResolvedValue(undefined);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Section 6 — Comments & Reactions", () => {
  // Mock global.fetch used by createComment / addReaction to resolve Clerk user profiles.
  // Assigned before each test so we control the resolved value; restored after.
  const mockFetch = jest.fn();

  beforeEach(() => {
    // resetAllMocks (not clearAllMocks) fully drains mockReturnValueOnce /
    // mockResolvedValueOnce queues between tests. This prevents a rate-limit test
    // from leaving an unconsumed { allowed: false } in the queue that then causes
    // an unrelated subsequent test to unexpectedly hit the rate limit.
    jest.resetAllMocks();
    resetMocks();

    // Install fetch mock — covers the Clerk user-profile API call inside the actions
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(CLERK_USER_RESPONSE),
    } as Response);
  });

  afterEach(() => {
    // Restore the original fetch so other test files are not affected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.1 createComment
  // ═══════════════════════════════════════════════════════════════════════════

  describe("createComment", () => {
    // ── Happy path: top-level comment ──────────────────────────────────────

    it("should create a top-level comment and return the comment data", async () => {
      const expected = makeComment();
      (db.card.findUnique    as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create     as jest.Mock).mockResolvedValueOnce(expected);

      const result = await createComment({
        cardId:  CARD_ID,
        boardId: BOARD_ID,
        text:    "<p>Hello world</p>",
        mentions: [],
        isDraft: false,
      });

      expect(result.error).toBeUndefined();
      expect(result.fieldErrors).toBeUndefined();
      expect(result.data?.id).toBe(COMMENT_ID);
      expect(result.data?.cardId).toBe(CARD_ID);
      expect(db.comment.create).toHaveBeenCalledTimes(1);

      const createArg = (db.comment.create as jest.Mock).mock.calls[0][0].data;
      expect(createArg.cardId).toBe(CARD_ID);
      expect(createArg.parentId).toBeNull();
    });

    // ── Happy path: nested reply with valid parentId ───────────────────────

    it("should create a nested reply when parentId belongs to the same card", async () => {
      const expected = makeComment({ parentId: PARENT_ID });

      (db.card.findUnique    as jest.Mock).mockResolvedValueOnce(makeCard());
      // parentId validation: found, same card
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce({ cardId: CARD_ID });
      (db.comment.create     as jest.Mock).mockResolvedValueOnce(expected);

      const result = await createComment({
        cardId:   CARD_ID,
        boardId:  BOARD_ID,
        text:     "<p>—Alice replied</p>",
        mentions: [],
        isDraft: false,
        parentId: PARENT_ID,
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.parentId).toBe(PARENT_ID);
      // Verify parentId was written into the DB row
      const createArg = (db.comment.create as jest.Mock).mock.calls[0][0].data;
      expect(createArg.parentId).toBe(PARENT_ID);
    });

    // ── Orphan nesting rejected: parentId belongs to a DIFFERENT card ──────

    it("should return error when parentId belongs to a different card (orphan nesting rejected)", async () => {
      (db.card.findUnique    as jest.Mock).mockResolvedValueOnce(makeCard());
      // Parent comment found but its cardId != our cardId
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce({ cardId: OTHER_CARD_ID });

      const result = await createComment({
        cardId:   CARD_ID,
        boardId:  BOARD_ID,
        text:     "<p>Reply</p>",
        mentions: [],
        isDraft: false,
        parentId: PARENT_ID,
      });

      expect(result.error).toMatch(/same card/i);
      // DB comment.create must NOT be called — no orphaned rows written
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    // ── Orphan nesting rejected: parentId does not exist in DB ─────────────

    it("should return error when parentId references a non-existent comment", async () => {
      (db.card.findUnique    as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(null); // parent not found

      const result = await createComment({
        cardId:   CARD_ID,
        boardId:  BOARD_ID,
        text:     "<p>Reply</p>",
        mentions: [],
        isDraft: false,
        parentId: PARENT_ID,
      });

      expect(result.error).toMatch(/not found/i);
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    // ── CardNotInOrg guard: cross-org card → FORBIDDEN ──────────────────────

    it("should return FORBIDDEN when the card belongs to a different org", async () => {
      // Card exists but belongs to a different org
      (db.card.findUnique as jest.Mock).mockResolvedValueOnce(
        makeCard({ list: { board: { orgId: OTHER_ORG_ID, title: "Other board" } } })
      );

      const result = await createComment({
        cardId:  CARD_ID,
        boardId: BOARD_ID,
        text:    "<p>Hack</p>",
        mentions: [],
        isDraft: false,
      });

      // TenantError(FORBIDDEN) → createSafeAction maps to the generic permission message
      expect(result.error).toBe("You do not have permission to perform this action.");
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    // ── Input validation: empty text ────────────────────────────────────────

    it("should return fieldErrors (not call DB) when text is empty", async () => {
      const result = await createComment({
        cardId:  CARD_ID,
        boardId: BOARD_ID,
        text:    "",
        mentions: [],
        isDraft: false,
      });

      expect(result.fieldErrors?.text).toBeDefined();
      expect(result.error).toBeUndefined();
      // Zod rejects before handler executes — zero DB calls
      expect(db.card.findUnique).not.toHaveBeenCalled();
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    // ── Input validation: text exceeds 10,000 characters ───────────────────

    it("should return fieldErrors when text exceeds 10,000 characters", async () => {
      const result = await createComment({
        cardId:  CARD_ID,
        boardId: BOARD_ID,
        text:    "x".repeat(10_001),
        mentions: [],
        isDraft: false,
      });

      expect(result.fieldErrors?.text).toBeDefined();
      expect(db.comment.create).not.toHaveBeenCalled();
    });

    // ── Input validation: text at exactly 10,000 characters is valid ───────

    it("should succeed when text is exactly 10,000 characters", async () => {
      (db.card.findUnique  as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create   as jest.Mock).mockResolvedValueOnce(makeComment({ text: "x".repeat(10_000) }));

      const result = await createComment({
        cardId:  CARD_ID,
        boardId: BOARD_ID,
        text:    "x".repeat(10_000),
        mentions: [],
        isDraft: false,
      });

      expect(result.fieldErrors).toBeUndefined();
      expect(db.comment.create).toHaveBeenCalledTimes(1);
    });

    // ── Input validation: non-UUID cardId ───────────────────────────────────

    it("should return fieldErrors when cardId is not a valid UUID", async () => {
      const result = await createComment({
        cardId:  "not-a-uuid",
        boardId: BOARD_ID,
        text:    "Hello",
        mentions: [],
        isDraft: false,
      });

      expect(result.fieldErrors?.cardId).toBeDefined();
      expect(db.card.findUnique).not.toHaveBeenCalled();
    });

    // ── Card not found ───────────────────────────────────────────────────────

    it("should throw when the card does not exist", async () => {
      (db.card.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        createComment({ cardId: CARD_ID, boardId: BOARD_ID, text: "Hi", mentions: [], isDraft: false })
      ).rejects.toThrow("Card not found");
    });

    // ── Rate limit exceeded ──────────────────────────────────────────────────

    it("should throw when the rate limit is exceeded", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 45_000 });

      await expect(
        createComment({ cardId: CARD_ID, boardId: BOARD_ID, text: "Hi", mentions: [], isDraft: false })
      ).rejects.toThrow(/Too many requests/i);
    });

    // ── Draft mode skips audit log ───────────────────────────────────────────

    it("should NOT call createAuditLog when isDraft is true", async () => {
      const { createAuditLog } = jest.requireMock("@/lib/create-audit-log") as { createAuditLog: jest.Mock };
      (db.card.findUnique  as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create   as jest.Mock).mockResolvedValueOnce(makeComment({ isDraft: true }));

      await createComment({ cardId: CARD_ID, boardId: BOARD_ID, text: "<p>Draft</p>", mentions: [], isDraft: true });

      expect(createAuditLog).not.toHaveBeenCalled();
    });

    // ── Non-draft comment creates audit log ─────────────────────────────────

    it("should call createAuditLog for a published (non-draft) comment", async () => {
      const { createAuditLog } = jest.requireMock("@/lib/create-audit-log") as { createAuditLog: jest.Mock };
      (db.card.findUnique  as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create   as jest.Mock).mockResolvedValueOnce(makeComment());

      await createComment({ cardId: CARD_ID, boardId: BOARD_ID, text: "<p>Published</p>", mentions: [], isDraft: false });

      expect(createAuditLog).toHaveBeenCalledTimes(1);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "CARD", action: "UPDATE", orgId: ORG_ID })
      );
    });

    // ── @Mentions: self-mentions are silently filtered ───────────────────────

    it("should NOT notify the commenter when they mention themselves", async () => {
      const { createNotification } = jest.requireMock("@/actions/notification-actions") as { createNotification: jest.Mock };
      (db.card.findUnique as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create  as jest.Mock).mockResolvedValueOnce(makeComment({ mentions: [USER_ID] }));

      await createComment({
        cardId:   CARD_ID,
        boardId:  BOARD_ID,
        text:     `<span data-mention="${USER_ID}">@Alice</span>`,
        mentions: [USER_ID], // mentioning yourself
        isDraft: false,
      });

      // Fire-and-forget notifications are filtered for self-mentions
      await new Promise((resolve) => process.nextTick(resolve));
      expect(createNotification).not.toHaveBeenCalled();
    });

    // ── @Mentions: third-party mention fires in-app notification ────────────

    it("should fire in-app notification when a different user is mentioned", async () => {
      const { createNotification } = jest.requireMock("@/actions/notification-actions") as { createNotification: jest.Mock };
      const { sendMentionEmail }   = jest.requireMock("@/lib/email") as { sendMentionEmail: jest.Mock };

      (db.card.findUnique  as jest.Mock).mockResolvedValueOnce(makeCard());
      (db.comment.create   as jest.Mock).mockResolvedValueOnce(
        makeComment({ mentions: [OTHER_USER_ID], userName: "Alice", userImage: null })
      );
      (db.user.findUnique  as jest.Mock).mockResolvedValueOnce({
        id: "db-user-999", email: "bob@example.com", name: "Bob",
      });

      await createComment({
        cardId:   CARD_ID,
        boardId:  BOARD_ID,
        text:     `<span data-mention="${OTHER_USER_ID}">@Bob</span>`,
        mentions: [OTHER_USER_ID],
        isDraft: false,
      });

      // Flush fire-and-forget micro-tasks (void Promise.allSettled(...))
      // A macrotask (setTimeout 0) reliably drains all pending Promises in the
      // chain: db.user.findUnique → sendMentionEmail → createNotification.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(createNotification).toHaveBeenCalledTimes(1);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: "MENTIONED", userId: "db-user-999" })
      );
      expect(sendMentionEmail).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.2 updateComment
  // ═══════════════════════════════════════════════════════════════════════════

  describe("updateComment", () => {
    it("should update text when caller owns the comment", async () => {
      const updated = makeComment({ text: "<p>Edited</p>" });
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(makeComment());
      (db.comment.update     as jest.Mock).mockResolvedValueOnce(updated);

      const result = await updateComment({
        id:      COMMENT_ID,
        boardId: BOARD_ID,
        text:    "<p>Edited</p>",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.text).toBe("<p>Edited</p>");
      const updateArg = (db.comment.update as jest.Mock).mock.calls[0][0];
      expect(updateArg.data.isDraft).toBe(false); // always clears draft flag
    });

    it("should return fieldErrors when text is empty", async () => {
      const result = await updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "" });
      expect(result.fieldErrors?.text).toBeDefined();
      expect(db.comment.findUnique).not.toHaveBeenCalled();
    });

    it("should throw when editing another user's comment", async () => {
      // Comment owned by OTHER_USER_ID, but ctx has USER_ID
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(
        makeComment({ userId: OTHER_USER_ID })
      );

      await expect(
        updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "<p>Hack</p>" })
      ).rejects.toThrow(/own comments/i);

      expect(db.comment.update).not.toHaveBeenCalled();
    });

    it("should throw when comment does not exist", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "<p>Hi</p>" })
      ).rejects.toThrow("Comment not found");
    });

    it("should throw when the comment's card belongs to a different org", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(
        makeComment({ userId: USER_ID, card: { id: CARD_ID, title: "T", list: { board: { orgId: OTHER_ORG_ID, title: "X" } } } })
      );

      await expect(
        updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "<p>Hi</p>" })
      ).rejects.toThrow(/Unauthorized/i);
    });

    it("should throw when rate limit is exceeded", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 10_000 });

      await expect(
        updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "<p>Hi</p>" })
      ).rejects.toThrow(/Too many requests/i);
    });

    it("should call createAuditLog after updating a comment", async () => {
      const { createAuditLog } = jest.requireMock("@/lib/create-audit-log") as { createAuditLog: jest.Mock };
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(makeComment());
      (db.comment.update     as jest.Mock).mockResolvedValueOnce(makeComment({ text: "<p>Updated</p>" }));

      await updateComment({ id: COMMENT_ID, boardId: BOARD_ID, text: "<p>Updated</p>" });

      expect(createAuditLog).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.3 deleteComment
  // ═══════════════════════════════════════════════════════════════════════════

  describe("deleteComment", () => {
    it("should delete the comment when caller is the owner", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(makeComment());
      (db.comment.delete     as jest.Mock).mockResolvedValueOnce({});

      const result = await deleteComment({ id: COMMENT_ID, boardId: BOARD_ID });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ success: true });
      expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
    });

    it("should throw when attempting to delete another user's comment", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(
        makeComment({ userId: OTHER_USER_ID })
      );

      await expect(
        deleteComment({ id: COMMENT_ID, boardId: BOARD_ID })
      ).rejects.toThrow(/own comments/i);

      expect(db.comment.delete).not.toHaveBeenCalled();
    });

    it("should throw when the comment does not exist", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        deleteComment({ id: COMMENT_ID, boardId: BOARD_ID })
      ).rejects.toThrow("Comment not found");
    });

    it("should throw when rate limit is exceeded", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 3_000 });

      await expect(
        deleteComment({ id: COMMENT_ID, boardId: BOARD_ID })
      ).rejects.toThrow(/Too many requests/i);
    });

    it("should cascade-delete reactions / replies because Prisma schema is onDelete: Cascade", async () => {
      // The DB schema (#@@map("comments"), parent Cascade) means deleting the parent
      // DB row is sufficient — we just verify comment.delete is called exactly once
      // (the cascade is enforced by the DB, not application code).
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(makeComment());
      (db.comment.delete     as jest.Mock).mockResolvedValueOnce({});

      await deleteComment({ id: COMMENT_ID, boardId: BOARD_ID });

      // Exactly one delete call — no additional cleanup loops required
      expect(db.comment.delete).toHaveBeenCalledTimes(1);
      // Reactions are NOT deleted individually by application code
      expect(db.commentReaction.delete).not.toHaveBeenCalled();
    });

    it("should call createAuditLog after successfully deleting a comment", async () => {
      const { createAuditLog } = jest.requireMock("@/lib/create-audit-log") as { createAuditLog: jest.Mock };
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(makeComment());
      (db.comment.delete     as jest.Mock).mockResolvedValueOnce({});

      await deleteComment({ id: COMMENT_ID, boardId: BOARD_ID });

      expect(createAuditLog).toHaveBeenCalledTimes(1);
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "UPDATE", entityType: "CARD" })
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.4 addReaction
  // ═══════════════════════════════════════════════════════════════════════════

  describe("addReaction", () => {
    // ── Happy path: valid single emoji ──────────────────────────────────────

    it("should create a reaction successfully when emoji is a valid single Unicode emoji '👍'", async () => {
      const expected = makeReaction();
      (db.comment.findUnique        as jest.Mock).mockResolvedValueOnce(
        makeComment({ card: { id: CARD_ID, title: "T", list: { board: { orgId: ORG_ID } } } })
      );
      (db.commentReaction.findFirst as jest.Mock).mockResolvedValueOnce(null); // no duplicate
      (db.commentReaction.create    as jest.Mock).mockResolvedValueOnce(expected);

      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "👍",
      });

      expect(result.error).toBeUndefined();
      expect(result.fieldErrors).toBeUndefined();
      expect(result.data?.emoji).toBe("👍");
      expect(db.commentReaction.create).toHaveBeenCalledTimes(1);
    });

    // ── Emoji regex rejects plain text ──────────────────────────────────────

    it("should return fieldErrors when emoji is a text word 'thumbsup' (regex /^[\\u{1F300}-\\u{1F9FF}]$/u rejects it)", async () => {
      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "thumbsup",
      });

      // Zod regex validation fails before the handler runs
      expect(result.fieldErrors?.emoji).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(db.comment.findUnique).not.toHaveBeenCalled();
      expect(db.commentReaction.create).not.toHaveBeenCalled();
    });

    // ── Emoji regex rejects multi-character sequences ───────────────────────

    it("should return fieldErrors when emoji is '👍👎' (two emojis — multi-character rejected by regex)", async () => {
      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "👍👎",
      });

      expect(result.fieldErrors?.emoji).toBeDefined();
      expect(db.commentReaction.create).not.toHaveBeenCalled();
    });

    // ── Emoji regex rejects ASCII characters ────────────────────────────────

    it("should return fieldErrors when emoji is a single ASCII character ':)'", async () => {
      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     ":)",
      });

      expect(result.fieldErrors?.emoji).toBeDefined();
      expect(db.commentReaction.create).not.toHaveBeenCalled();
    });

    // ── Duplicate reaction: same user + same emoji on same comment ──────────

    it("should return { error: 'Already reacted' } when the same user reacts with the same emoji twice", async () => {
      (db.comment.findUnique        as jest.Mock).mockResolvedValueOnce(
        makeComment({ card: { id: CARD_ID, title: "T", list: { board: { orgId: ORG_ID } } } })
      );
      // Simulate the existing reaction (DB unique constraint would enforce this in prod)
      (db.commentReaction.findFirst as jest.Mock).mockResolvedValueOnce(makeReaction());

      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "👍",
      });

      expect(result.error).toBe("Already reacted");
      expect(result.data).toBeUndefined();
    });

    // ── Reaction count NOT incremented twice ────────────────────────────────

    it("should NOT call commentReaction.create when a duplicate reaction is detected (count not incremented twice)", async () => {
      (db.comment.findUnique        as jest.Mock).mockResolvedValueOnce(
        makeComment({ card: { id: CARD_ID, title: "T", list: { board: { orgId: ORG_ID } } } })
      );
      (db.commentReaction.findFirst as jest.Mock).mockResolvedValueOnce(makeReaction());

      await addReaction({ commentId: COMMENT_ID, boardId: BOARD_ID, emoji: "👍" });

      // The DB insert never happens — count is provably not incremented
      expect(db.commentReaction.create).not.toHaveBeenCalled();
    });

    // ── Second call with a DIFFERENT emoji by same user succeeds ────────────

    it("should succeed when the same user reacts with a DIFFERENT emoji (not a duplicate)", async () => {
      // 🎉 = U+1F389 which is inside the valid range \u{1F300}-\u{1F9FF}
      const partyReaction = makeReaction({ emoji: "🎉" });
      (db.comment.findUnique        as jest.Mock).mockResolvedValueOnce(
        makeComment({ card: { id: CARD_ID, title: "T", list: { board: { orgId: ORG_ID } } } })
      );
      (db.commentReaction.findFirst as jest.Mock).mockResolvedValueOnce(null); // different emoji → no duplicate
      (db.commentReaction.create    as jest.Mock).mockResolvedValueOnce(partyReaction);

      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "🎉",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.emoji).toBe("🎉");
      expect(db.commentReaction.create).toHaveBeenCalledTimes(1);
    });

    // ── Cross-org guard ──────────────────────────────────────────────────────

    it("should return FORBIDDEN when the comment's card belongs to a different org", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(
        makeComment({ card: { id: CARD_ID, title: "T", list: { board: { orgId: OTHER_ORG_ID } } } })
      );

      const result = await addReaction({
        commentId: COMMENT_ID,
        boardId:   BOARD_ID,
        emoji:     "👍",
      });

      expect(result.error).toBe("You do not have permission to perform this action.");
      expect(db.commentReaction.create).not.toHaveBeenCalled();
    });

    // ── Comment not found ────────────────────────────────────────────────────

    it("should throw when the comment does not exist", async () => {
      (db.comment.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        addReaction({ commentId: COMMENT_ID, boardId: BOARD_ID, emoji: "👍" })
      ).rejects.toThrow("Comment not found");
    });

    // ── Rate limit exceeded ──────────────────────────────────────────────────

    it("should throw when add-reaction rate limit is exceeded", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 5_000 });

      await expect(
        addReaction({ commentId: COMMENT_ID, boardId: BOARD_ID, emoji: "👍" })
      ).rejects.toThrow(/Too many requests/i);
    });

    // ── Non-UUID commentId ───────────────────────────────────────────────────

    it("should return fieldErrors when commentId is not a valid UUID", async () => {
      const result = await addReaction({
        commentId: "not-a-uuid",
        boardId:   BOARD_ID,
        emoji:     "👍",
      });

      expect(result.fieldErrors?.commentId).toBeDefined();
      expect(db.comment.findUnique).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6.5 removeReaction
  // ═══════════════════════════════════════════════════════════════════════════

  describe("removeReaction", () => {
    it("should delete the reaction when caller owns it", async () => {
      (db.commentReaction.findUnique as jest.Mock).mockResolvedValueOnce(makeReaction());
      (db.commentReaction.delete     as jest.Mock).mockResolvedValueOnce({});

      const result = await removeReaction({ id: REACTION_ID, boardId: BOARD_ID });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({ success: true });
      expect(db.commentReaction.delete).toHaveBeenCalledWith({ where: { id: REACTION_ID } });
      expect(db.commentReaction.delete).toHaveBeenCalledTimes(1);
    });

    it("should throw when attempting to remove another user's reaction", async () => {
      (db.commentReaction.findUnique as jest.Mock).mockResolvedValueOnce(
        makeReaction({ userId: OTHER_USER_ID })
      );

      await expect(
        removeReaction({ id: REACTION_ID, boardId: BOARD_ID })
      ).rejects.toThrow(/own reactions/i);

      expect(db.commentReaction.delete).not.toHaveBeenCalled();
    });

    it("should throw when the reaction does not exist", async () => {
      (db.commentReaction.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        removeReaction({ id: REACTION_ID, boardId: BOARD_ID })
      ).rejects.toThrow("Reaction not found");
    });

    it("should throw when remove-reaction rate limit is exceeded", async () => {
      const { checkRateLimit } = jest.requireMock("@/lib/action-protection") as { checkRateLimit: jest.Mock };
      checkRateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetInMs: 2_000 });

      await expect(
        removeReaction({ id: REACTION_ID, boardId: BOARD_ID })
      ).rejects.toThrow(/Too many requests/i);
    });

    it("should throw when the reaction's comment belongs to a different org", async () => {
      (db.commentReaction.findUnique as jest.Mock).mockResolvedValueOnce(
        makeReaction({
          userId: USER_ID,
          comment: { card: { list: { board: { orgId: OTHER_ORG_ID } } } },
        })
      );

      await expect(
        removeReaction({ id: REACTION_ID, boardId: BOARD_ID })
      ).rejects.toThrow(/Unauthorized/i);

      expect(db.commentReaction.delete).not.toHaveBeenCalled();
    });

    it("should return fieldErrors when id is not a valid UUID", async () => {
      const result = await removeReaction({ id: "bad-id", boardId: BOARD_ID });
      expect(result.fieldErrors?.id).toBeDefined();
      expect(db.commentReaction.findUnique).not.toHaveBeenCalled();
    });
  });
});

