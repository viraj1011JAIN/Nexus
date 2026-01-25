import { z } from "zod";

// ============================================
// BOARD SCHEMAS
// ============================================

export const CreateBoard = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(50, "Title must be less than 50 characters"),
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
  boardId: z.string(),
  description: z.string().min(3, "Description is too short").optional(),
  title: z.string().min(3, "Title is too short").optional(),
  id: z.string(),
});