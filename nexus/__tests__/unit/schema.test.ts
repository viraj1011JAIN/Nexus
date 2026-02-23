/**
 * Unit Tests: Zod Schema Validation (actions/schema.ts)
 *
 * Tests every schema for both valid and invalid inputs,
 * covering boundary conditions and error message quality.
 */

import {
  CreateBoard,
  DeleteBoard,
  CreateList,
  UpdateList,
  CreateCard,
  UpdateCard,
  CreateLabel,
  AssignLabel,
  UnassignLabel,
  AssignUser,
  UnassignUser,
} from "@/actions/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectValid<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T } }, data: unknown): T {
  const result = schema.safeParse(data);
  expect(result.success).toBe(true);
  return result.data as T;
}

function expectInvalid(
  schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } },
  data: unknown,
  expectedMessage?: string
) {
  const result = schema.safeParse(data);
  expect(result.success).toBe(false);
  if (expectedMessage) {
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.includes(expectedMessage))).toBe(true);
  }
}

const VALID_UUID = "00000000-0000-4000-8000-000000000001";

// ─── CreateBoard ──────────────────────────────────────────────────────────────

describe("CreateBoard", () => {
  it("accepts minimal valid input (title only)", () => {
    expectValid(CreateBoard, { title: "My Board" });
  });

  it("rejects title shorter than 3 characters", () => {
    expectInvalid(CreateBoard, { title: "AB" }, "at least 3 characters");
  });

  it("rejects title longer than 50 characters", () => {
    expectInvalid(CreateBoard, { title: "A".repeat(51) }, "less than 50");
  });

  it("accepts title at min boundary (3 chars)", () => {
    expectValid(CreateBoard, { title: "ABC" });
  });

  it("accepts title at max boundary (50 chars)", () => {
    expectValid(CreateBoard, { title: "A".repeat(50) });
  });

  it("accepts optional image fields when all are present", () => {
    const data = {
      title: "My Board",
      imageId: "abc123",
      imageThumbUrl: "https://images.unsplash.com/thumb.jpg",
      imageFullUrl: "https://images.unsplash.com/full.jpg",
      imageUserName: "photographer",
      imageLinkUrl: 'https://unsplash.com/@p',
    };
    expectValid(CreateBoard, data);
  });

  it("rejects invalid URL for imageThumbUrl", () => {
    expectInvalid(CreateBoard, { title: "My Board", imageThumbUrl: "not-a-url" });
  });

  it("rejects invalid URL for imageFullUrl", () => {
    expectInvalid(CreateBoard, { title: "My Board", imageFullUrl: "just-plain-text-no-url" });
  });

  it("accepts a valid UUID templateId", () => {
    expectValid(CreateBoard, { title: "Board", templateId: VALID_UUID });
  });

  it("rejects non-UUID templateId", () => {
    expectInvalid(CreateBoard, { title: "Board", templateId: "not-a-uuid" });
  });

  it("allows templateId to be omitted", () => {
    const result = CreateBoard.safeParse({ title: "Board" });
    expect(result.success).toBe(true);
    expect((result.data as {templateId?: string}).templateId).toBeUndefined();
  });
});

// ─── DeleteBoard ──────────────────────────────────────────────────────────────

describe("DeleteBoard", () => {
  it("accepts a valid id", () => {
    expectValid(DeleteBoard, { id: VALID_UUID });
  });

  it("rejects missing id", () => {
    expectInvalid(DeleteBoard, {});
  });
});

// ─── CreateList ───────────────────────────────────────────────────────────────

describe("CreateList", () => {
  it("accepts valid title and boardId", () => {
    expectValid(CreateList, { title: "To Do", boardId: "board_1" });
  });

  it("rejects empty title", () => {
    expectInvalid(CreateList, { title: "", boardId: "board_1" }, "required");
  });

  it("rejects title over 50 characters", () => {
    expectInvalid(CreateList, { title: "A".repeat(51), boardId: "board_1" }, "less than 50");
  });

  it("rejects missing boardId", () => {
    expectInvalid(CreateList, { title: "To Do" });
  });
});

// ─── UpdateList ───────────────────────────────────────────────────────────────

describe("UpdateList", () => {
  it("accepts valid update payload", () => {
    expectValid(UpdateList, { title: "Done", id: "list_1", boardId: "board_1" });
  });

  it("rejects empty title", () => {
    expectInvalid(UpdateList, { title: "", id: "list_1", boardId: "board_1" }, "required");
  });

  it("requires all three fields", () => {
    expectInvalid(UpdateList, { title: "Done", id: "list_1" });
  });
});

// ─── CreateCard ───────────────────────────────────────────────────────────────

describe("CreateCard", () => {
  it("accepts valid card creation", () => {
    expectValid(CreateCard, { title: "My Task", listId: "list_1", boardId: "board_1" });
  });

  it("rejects empty title", () => {
    expectInvalid(CreateCard, { title: "", listId: "list_1", boardId: "board_1" }, "required");
  });

  it("rejects title over 100 characters", () => {
    expectInvalid(
      CreateCard,
      { title: "A".repeat(101), listId: "list_1", boardId: "board_1" },
      "less than 100"
    );
  });
});

// ─── UpdateCard ───────────────────────────────────────────────────────────────

describe("UpdateCard", () => {
  it("accepts update with title only", () => {
    expectValid(UpdateCard, { id: VALID_UUID, boardId: VALID_UUID, title: "New title" });
  });

  it("accepts update with description only", () => {
    expectValid(UpdateCard, {
      id: VALID_UUID,
      boardId: VALID_UUID,
      description: "A longer description for the card",
    });
  });

  it("rejects non-UUID id", () => {
    expectInvalid(UpdateCard, { id: "not-uuid", boardId: VALID_UUID }, "Invalid card ID");
  });

  it("rejects non-UUID boardId", () => {
    expectInvalid(UpdateCard, { id: VALID_UUID, boardId: "not-uuid" }, "Invalid board ID");
  });

  it("rejects description shorter than 3 characters", () => {
    expectInvalid(
      UpdateCard,
      { id: VALID_UUID, boardId: VALID_UUID, description: "Hi" },
      "too short"
    );
  });

  it("rejects title shorter than 3 characters", () => {
    expectInvalid(UpdateCard, { id: VALID_UUID, boardId: VALID_UUID, title: "AB" }, "too short");
  });

  it("allows both title and description simultaneously", () => {
    expectValid(UpdateCard, {
      id: VALID_UUID,
      boardId: VALID_UUID,
      title: "New Title",
      description: "Updated description",
    });
  });
});

// ─── CreateLabel ──────────────────────────────────────────────────────────────

describe("CreateLabel", () => {
  it("accepts valid label", () => {
    expectValid(CreateLabel, {
      name: "Bug",
      color: "#FF0000",
      orgId: VALID_UUID,
    });
  });

  it("rejects empty name", () => {
    expectInvalid(CreateLabel, { name: "", color: "#FF0000", orgId: VALID_UUID }, "required");
  });

  it("rejects name over 50 characters", () => {
    expectInvalid(
      CreateLabel,
      { name: "A".repeat(51), color: "#FF0000", orgId: VALID_UUID },
      "less than 50"
    );
  });

  it("rejects invalid hex color (short)", () => {
    expectInvalid(CreateLabel, { name: "Bug", color: "#FFF", orgId: VALID_UUID }, "Invalid color format");
  });

  it("rejects invalid hex color (wrong prefix)", () => {
    expectInvalid(CreateLabel, { name: "Bug", color: "FF0000", orgId: VALID_UUID }, "Invalid color format");
  });

  it("accepts all 6-digit hex colour formats", () => {
    expectValid(CreateLabel, { name: "Feat", color: "#A1B2C3", orgId: VALID_UUID });
    expectValid(CreateLabel, { name: "Feat", color: "#a1b2c3", orgId: VALID_UUID });
  });

  it("rejects special characters in label name", () => {
    expectInvalid(
      CreateLabel,
      { name: "<script>", color: "#FF0000", orgId: VALID_UUID },
      "invalid characters"
    );
  });

  it("rejects non-UUID orgId", () => {
    expectInvalid(CreateLabel, { name: "Bug", color: "#FF0000", orgId: "not-uuid" }, "Invalid organization ID");
  });
});

// ─── AssignLabel / UnassignLabel ──────────────────────────────────────────────

describe("AssignLabel", () => {
  const valid = { cardId: VALID_UUID, labelId: VALID_UUID, orgId: VALID_UUID };

  it("accepts all valid UUIDs", () => {
    expectValid(AssignLabel, valid);
  });

  it("rejects invalid cardId", () => {
    expectInvalid(AssignLabel, { ...valid, cardId: "bad" }, "Invalid card ID");
  });

  it("rejects invalid labelId", () => {
    expectInvalid(AssignLabel, { ...valid, labelId: "bad" }, "Invalid label ID");
  });

  it("rejects invalid orgId", () => {
    expectInvalid(AssignLabel, { ...valid, orgId: "bad" }, "Invalid organization ID");
  });
});

describe("UnassignLabel", () => {
  const valid = { cardId: VALID_UUID, labelId: VALID_UUID, orgId: VALID_UUID };

  it("accepts all valid UUIDs", () => {
    expectValid(UnassignLabel, valid);
  });

  it("rejects invalid cardId", () => {
    expectInvalid(UnassignLabel, { ...valid, cardId: "bad" }, "Invalid card ID");
  });
});

// ─── AssignUser / UnassignUser ────────────────────────────────────────────────

describe("AssignUser", () => {
  const valid = { cardId: VALID_UUID, assigneeId: "user_clerk_123", orgId: VALID_UUID };

  it("accepts valid payload including non-UUID assigneeId", () => {
    // Clerk IDs are NOT UUIDs — the schema must accept any string
    expectValid(AssignUser, valid);
  });

  it("accepts a Clerk-style user ID", () => {
    expectValid(AssignUser, { cardId: VALID_UUID, assigneeId: "user_2abc123xyz", orgId: VALID_UUID });
  });

  it("rejects invalid cardId", () => {
    expectInvalid(AssignUser, { ...valid, cardId: "bad" }, "Invalid card ID");
  });

  it("rejects invalid orgId", () => {
    expectInvalid(AssignUser, { ...valid, orgId: "bad" }, "Invalid organization ID");
  });
});

describe("UnassignUser", () => {
  const valid = { cardId: VALID_UUID, orgId: VALID_UUID };

  it("accepts valid payload", () => {
    expectValid(UnassignUser, valid);
  });

  it("rejects invalid cardId", () => {
    expectInvalid(UnassignUser, { ...valid, cardId: "bad" }, "Invalid card ID");
  });
});
