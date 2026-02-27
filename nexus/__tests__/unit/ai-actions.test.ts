/**
 * TASK-031 — Unit tests: ai-actions
 *
 * Covers: suggestPriority, generateCardDescription, suggestChecklists
 * Validates: rate-limit enforcement, OpenAI mock response parsing, input validation
 */

import {
  suggestPriority,
  generateCardDescription,
  suggestChecklists,
} from "@/actions/ai-actions";
import { db } from "@/lib/db";

const ORG = { id: "org_1", aiCallsToday: 0, aiCallsResetAt: new Date(), aiCallsLimit: 100 };

// ─── Mock OpenAI ─────────────────────────────────────────────────────────────
// process.env.OPENAI_API_KEY is set in jest.setup.ts so ai-actions.ts
// initialises the OpenAI singleton (new OpenAI()) instead of leaving it null.
// __esModule:true is required so TS esModuleInterop uses `.default` directly.
// The `create` property uses a wrapper arrow fn so `mockCreate` is resolved
// lazily at call time (not at module-init construction time), avoiding TDZ.
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: (...args: unknown[]) => (mockCreate as (...a: unknown[]) => unknown)(...args) } },
  })),
}));

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId:  "org_1",
    orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  }),
  requireRole:   jest.fn().mockResolvedValue(undefined),
  isDemoContext: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    organization: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

function resetMocks() {
  const { getTenantContext, isDemoContext } = jest.requireMock("@/lib/tenant-context") as {
    getTenantContext: jest.Mock; isDemoContext: jest.Mock;
  };
  getTenantContext.mockResolvedValue({
    userId: "user_1", orgId: "org_1", orgRole: "org:member",
    membership: { role: "MEMBER", isActive: true },
  });
  isDemoContext.mockReturnValue(false);
  (db.organization.findUnique as jest.Mock).mockResolvedValue({ ...ORG });
  (db.organization.update as jest.Mock).mockResolvedValue({ ...ORG, aiCallsToday: 1 });
  // Default response for suggestPriority (must be valid JSON so JSON.parse succeeds)
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: '{"priority":"MEDIUM","reasoning":"Default mock reasoning."}' } }],
  });
}

describe("ai-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── suggestPriority ──────────────────────────────────────────────────────

  describe("suggestPriority", () => {
    it("returns a priority suggestion from OpenAI", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"priority":"HIGH","reasoning":"Critical login issues require immediate attention."}' } }],
      });
      const result = await suggestPriority({ title: "Fix critical login bug", description: "Users cannot log in" });
      expect(result.error).toBeUndefined();
      expect(result.data?.priority).toBe("HIGH");
    });

    it("calls OpenAI exactly once per request", async () => {
      await suggestPriority({ title: "Add dark mode", description: "" });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("increments aiCallsToday after successful call", async () => {
      await suggestPriority({ title: "Test card", description: "" });
      expect(db.organization.update).toHaveBeenCalled();
    });

    it("returns error when rate limit is reached", async () => {
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        ...ORG, aiCallsToday: 100, aiCallsLimit: 100,
      });
      const result = await suggestPriority({ title: "Over limit", description: "" });
      expect(result.error).toBeDefined();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns error when title is empty", async () => {
      const result = await suggestPriority({ title: "", description: "" });
      expect(result.error).toBeDefined();
    });
  });

  // ─── generateCardDescription ──────────────────────────────────────────────

  describe("generateCardDescription", () => {
    it("returns generated description", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Implement dark mode toggle for user preference." } }],
      });
      const result = await generateCardDescription({ title: "Dark mode", context: "Settings page" });
      expect(result.error).toBeUndefined();
      expect(typeof result.data?.description).toBe("string");
      expect(result.data?.description.length).toBeGreaterThan(0);
    });

    it("returns error on OpenAI failure", async () => {
      // The action wraps OpenAI calls in try/catch and returns a graceful error.
      mockCreate.mockRejectedValueOnce(new Error("OpenAI API unavailable"));
      const result = await generateCardDescription({ title: "Feature", context: "" });
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  // ─── suggestChecklists ────────────────────────────────────────────────────

  describe("suggestChecklists", () => {
    it("returns an array of checklist suggestions", async () => {
      // The action expects { items: string[] } JSON — not the array-of-objects format.
      const validChecklistJson = JSON.stringify({ items: ["Create repo", "Add README", "Write code", "Write tests"] });
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: validChecklistJson } }],
      });
      const result = await suggestChecklists({ title: "New feature", description: "Add export button" });
      expect(result.error).toBeUndefined();
      // Source returns { data: { items: string[] } }
      expect(Array.isArray(result.data?.items)).toBe(true);
      expect((result.data?.items?.length ?? 0)).toBeGreaterThan(0);
    });

    it("returns error when rate limit is reached", async () => {
      (db.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        ...ORG, aiCallsToday: 100, aiCallsLimit: 100,
      });
      const result = await suggestChecklists({ title: "Feature", description: "" });
      expect(result.error).toBeDefined();
    });
  });
});
