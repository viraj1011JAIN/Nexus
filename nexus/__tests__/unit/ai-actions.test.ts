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
const mockCreate = jest.fn();
jest.mock("openai", () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
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
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: "MEDIUM" } }],
  });
}

describe("ai-actions", () => {
  beforeEach(() => { jest.clearAllMocks(); resetMocks(); });

  // ─── suggestPriority ──────────────────────────────────────────────────────

  describe("suggestPriority", () => {
    it("returns a priority suggestion from OpenAI", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "HIGH" } }],
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
      mockCreate.mockRejectedValueOnce(new Error("OpenAI unavailable"));
      const result = await generateCardDescription({ title: "Feature", context: "" });
      expect(result.error).toBeDefined();
    });
  });

  // ─── suggestChecklists ────────────────────────────────────────────────────

  describe("suggestChecklists", () => {
    const checklistJson = JSON.stringify([
      { title: "Setup", items: ["Create repo", "Add README"] },
      { title: "Implementation", items: ["Write code", "Write tests"] },
    ]);

    it("returns an array of checklist suggestions", async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: checklistJson } }],
      });
      const result = await suggestChecklists({ title: "New feature", description: "Add export button" });
      expect(result.error).toBeUndefined();
      expect(Array.isArray(result.data?.checklists)).toBe(true);
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
