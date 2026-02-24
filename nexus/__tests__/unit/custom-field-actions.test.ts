/**
 * TASK-031 — Unit tests: custom-field-actions
 *
 * Actual signatures:
 *   createCustomField(name, type, boardId?, options?, isRequired?)
 *   updateCustomField(fieldId, { name?, isRequired?, options? })
 *   deleteCustomField(fieldId)
 */

import { createCustomField, updateCustomField, deleteCustomField } from "@/actions/custom-field-actions";
import { db } from "@/lib/db";

jest.mock("@/lib/tenant-context", () => ({
  getTenantContext: jest.fn().mockResolvedValue({
    userId: "user_1",
    orgId: "org_1",
    orgRole: "org:admin",
    membership: { role: "ADMIN", isActive: true },
  }),
  requireRole:      jest.fn().mockResolvedValue(undefined),
  isDemoContext:    jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/db", () => ({
  db: {
    customField: {
      create:    jest.fn(),
      findFirst: jest.fn(),
      update:    jest.fn(),
      delete:    jest.fn(),
      aggregate: jest.fn().mockResolvedValue({ _max: { order: 0 } }),
    },
    board: { findFirst: jest.fn() },
  },
}));

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1", orgId: "org_1" }),
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

const BOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FIELD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("custom-field-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getTenantContext, requireRole, isDemoContext } = jest.requireMock("@/lib/tenant-context") as {
      getTenantContext: jest.Mock; requireRole: jest.Mock; isDemoContext: jest.Mock;
    };
    getTenantContext.mockResolvedValue({
      userId: "user_1", orgId: "org_1", orgRole: "org:admin",
      membership: { role: "ADMIN", isActive: true },
    });
    requireRole.mockResolvedValue(undefined);
    isDemoContext.mockReturnValue(false);
    (db.customField.aggregate as jest.Mock).mockResolvedValue({ _max: { order: 0 } });
  });

  describe("createCustomField", () => {
    it("requires a name", async () => {
      const result = await createCustomField("", "TEXT", BOARD_ID);
      expect(result.error).toBeDefined();
    });

    it("creates a text field", async () => {
      (db.customField.create as jest.Mock).mockResolvedValueOnce({
        id: FIELD_ID, name: "Notes", type: "TEXT",
      });

      const result = await createCustomField("Notes", "TEXT", BOARD_ID);
      expect(result.error).toBeUndefined();
      expect(db.customField.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateCustomField", () => {
    it("updates name", async () => {
      (db.customField.findFirst as jest.Mock).mockResolvedValueOnce({
        id: FIELD_ID, type: "TEXT", boardId: BOARD_ID,
      });
      (db.customField.update as jest.Mock).mockResolvedValueOnce({ id: FIELD_ID, name: "Updated" });

      const result = await updateCustomField(FIELD_ID, { name: "Updated" });
      expect(result.error).toBeUndefined();
    });

    it("returns error if field not found", async () => {
      (db.customField.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await updateCustomField(FIELD_ID, { name: "X" });
      expect(result.error).toBeDefined();
    });
  });

  describe("deleteCustomField", () => {
    it("deletes an existing field", async () => {
      (db.customField.findFirst as jest.Mock).mockResolvedValueOnce({
        id: FIELD_ID, boardId: BOARD_ID,
      });
      (db.customField.delete as jest.Mock).mockResolvedValueOnce({ id: FIELD_ID });

      const result = await deleteCustomField(FIELD_ID);
      expect(result.error).toBeUndefined();
      expect(db.customField.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: FIELD_ID } })
      );
    });

    it("returns error when field not found", async () => {
      (db.customField.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const result = await deleteCustomField("f0000000-0000-0000-0000-000000000001");
      expect(result.error).toBeDefined();
    });
  });
});

