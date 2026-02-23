import { z } from "zod";

// ============================================
// BOARD SCHEMAS
// ============================================

export const CreateBoard = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(50, "Title must be less than 50 characters"),
  // Unsplash background (optional)
  imageId:       z.string().optional(),
  imageThumbUrl: z.string().url().optional(),
  imageFullUrl:  z.string().url().optional(),
  imageUserName: z.string().optional(),
  imageLinkUrl:  z.string().url().optional(),
  // Board template (optional)
  templateId:    z.string().uuid().optional(),
});

export const DeleteBoard = z.object({
  id: z.string(),
});

// ============================================
// LIST SCHEMAS
// ============================================

export const CreateList = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(50, "Title must be less than 50 characters"),
  boardId: z.string(),
});

export const UpdateList = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(50, "Title must be less than 50 characters"),
  id: z.string(),
  boardId: z.string(),
});

// ============================================
// CARD SCHEMAS
// ============================================

export const CreateCard = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  listId: z.string(),
  boardId: z.string(),
});

export const UpdateCard = z.object({
  boardId: z.string().uuid("Invalid board ID"),
  description: z
    .string()
    .min(3, "Description is too short")
    .max(10000, "Description is too long")
    .optional(),
  title: z
    .string()
    .min(3, "Title is too short")
    .max(100, "Title must be less than 100 characters")
    .optional(),
  id: z.string().uuid("Invalid card ID"),
  // TASK-010: Cover
  coverColor: z.string().max(50).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  // TASK-013/TASK-023: Sprint / Epic / Story points
  sprintId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  storyPoints: z.number().int().min(0).max(999).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(100000).nullable().optional(),
});

// ============================================
// LABEL SCHEMAS (Enhanced Security)
// ============================================

export const CreateLabel = z.object({
  name: z
    .string()
    .min(1, "Label name is required")
    .max(50, "Label name must be less than 50 characters")
    .regex(/^[a-zA-Z0-9\s\-_]+$/, "Label name contains invalid characters"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format (must be hex)"),
  orgId: z.string().uuid("Invalid organization ID"),
});

export const AssignLabel = z.object({
  cardId: z.string().uuid("Invalid card ID"),
  labelId: z.string().uuid("Invalid label ID"),
  orgId: z.string().uuid("Invalid organization ID"),
});

export const UnassignLabel = z.object({
  cardId: z.string().uuid("Invalid card ID"),
  labelId: z.string().uuid("Invalid label ID"),
  orgId: z.string().uuid("Invalid organization ID"),
});

// ============================================
// ASSIGNEE SCHEMAS (Enhanced Security)
// ============================================

export const AssignUser = z.object({
  cardId: z.string().uuid("Invalid card ID"),
  assigneeId: z.string(), // Clerk user IDs are not UUIDs
  orgId: z.string().uuid("Invalid organization ID"),
});

export const UnassignUser = z.object({
  cardId: z.string().uuid("Invalid card ID"),
  orgId: z.string().uuid("Invalid organization ID"),
});