"use client";

/**
 * Demo Data Store (Zustand) — client-side in-memory board/card state.
 *
 * Limits:
 *   - Max 2 boards
 *   - Max 10 cards total (across all boards)
 *   - Drag-and-drop within/across lists is free (no limit)
 *   - No persistence — refreshing resets to seed data
 *
 * All data lives purely in the browser. No DB, no server actions.
 */

import { create } from "zustand";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DemoCard {
  id: string;
  title: string;
  listId: string;
  boardId: string;
  order: string;
  priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
  description?: string;
}

export interface DemoList {
  id: string;
  title: string;
  boardId: string;
  order: string;
}

export interface DemoBoard {
  id: string;
  title: string;
  emoji: string;
  color: string;
}

// ── Limits ───────────────────────────────────────────────────────────────────

export const DEMO_MAX_BOARDS = 2;
export const DEMO_MAX_CARDS = 10;

// ── Seed Data ────────────────────────────────────────────────────────────────

const SEED_BOARDS: DemoBoard[] = [
  { id: "demo-b1", title: "Product Roadmap", emoji: "\ud83d\uddfa\ufe0f", color: "from-violet-600 to-indigo-600" },
  { id: "demo-b2", title: "Sprint 47",       emoji: "\u26a1",            color: "from-pink-600 to-rose-600"     },
];

const SEED_LISTS: DemoList[] = [
  { id: "demo-l1", title: "To Do",        boardId: "demo-b1", order: "a" },
  { id: "demo-l2", title: "In Progress",  boardId: "demo-b1", order: "b" },
  { id: "demo-l3", title: "Done",         boardId: "demo-b1", order: "c" },
  { id: "demo-l4", title: "Backlog",      boardId: "demo-b2", order: "a" },
  { id: "demo-l5", title: "In Progress",  boardId: "demo-b2", order: "b" },
  { id: "demo-l6", title: "Completed",    boardId: "demo-b2", order: "c" },
];

const SEED_CARDS: DemoCard[] = [
  { id: "demo-c1", title: "Design new landing page",     listId: "demo-l1", boardId: "demo-b1", order: "a", priority: "HIGH"   },
  { id: "demo-c2", title: "Set up CI/CD pipeline",       listId: "demo-l1", boardId: "demo-b1", order: "b", priority: "MEDIUM" },
  { id: "demo-c3", title: "Implement auth flow",         listId: "demo-l2", boardId: "demo-b1", order: "a", priority: "URGENT" },
  { id: "demo-c4", title: "Write API documentation",     listId: "demo-l3", boardId: "demo-b1", order: "a", priority: "LOW"    },
  { id: "demo-c5", title: "Fix dark mode contrast",      listId: "demo-l4", boardId: "demo-b2", order: "a", priority: "HIGH"   },
  { id: "demo-c6", title: "Add real-time notifications", listId: "demo-l5", boardId: "demo-b2", order: "a", priority: "MEDIUM" },
];

// ── Utility ──────────────────────────────────────────────────────────────────

let counter = 100;
function uid() {
  counter += 1;
  return `demo-${Date.now()}-${counter}`;
}

// ── Store ────────────────────────────────────────────────────────────────────

interface DemoDataState {
  boards: DemoBoard[];
  lists: DemoList[];
  cards: DemoCard[];

  // Board actions
  createBoard: (title: string) => { error?: string };
  deleteBoard: (boardId: string) => void;

  // Card actions
  createCard: (listId: string, boardId: string, title: string) => { error?: string };
  deleteCard: (cardId: string) => void;
  moveCard: (cardId: string, toListId: string, newOrder: string) => void;

  // Bulk reorder (for DnD)
  reorderCards: (listId: string, orderedIds: string[]) => void;
  moveCardToList: (cardId: string, fromListId: string, toListId: string, index: number) => void;

  // Queries
  getBoardLists: (boardId: string) => DemoList[];
  getListCards: (listId: string) => DemoCard[];
  getTotalCardCount: () => number;
}

const BOARD_COLORS = [
  "from-violet-600 to-indigo-600",
  "from-pink-600 to-rose-600",
  "from-cyan-600 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-emerald-600 to-teal-600",
];

const BOARD_EMOJIS = ["\ud83d\udcdd", "\ud83d\ude80", "\ud83c\udfaf", "\ud83d\udca1", "\u2b50"];

export const useDemoData = create<DemoDataState>((set, get) => ({
  boards: [...SEED_BOARDS],
  lists: [...SEED_LISTS],
  cards: [...SEED_CARDS],

  createBoard: (title: string) => {
    const { boards } = get();
    if (boards.length >= DEMO_MAX_BOARDS) {
      return { error: `Demo limit: max ${DEMO_MAX_BOARDS} boards. Sign up for unlimited boards!` };
    }
    const id = uid();
    const colorIndex = boards.length % BOARD_COLORS.length;
    const emojiIndex = boards.length % BOARD_EMOJIS.length;
    const newBoard: DemoBoard = {
      id,
      title,
      emoji: BOARD_EMOJIS[emojiIndex],
      color: BOARD_COLORS[colorIndex],
    };
    // Every board gets 3 default lists
    const newLists: DemoList[] = [
      { id: uid(), title: "To Do",       boardId: id, order: "a" },
      { id: uid(), title: "In Progress", boardId: id, order: "b" },
      { id: uid(), title: "Done",        boardId: id, order: "c" },
    ];
    set((s) => ({
      boards: [...s.boards, newBoard],
      lists: [...s.lists, ...newLists],
    }));
    return {};
  },

  deleteBoard: (boardId: string) => {
    set((s) => ({
      boards: s.boards.filter((b) => b.id !== boardId),
      lists: s.lists.filter((l) => l.boardId !== boardId),
      cards: s.cards.filter((c) => c.boardId !== boardId),
    }));
  },

  createCard: (listId: string, boardId: string, title: string) => {
    const { cards } = get();
    if (cards.length >= DEMO_MAX_CARDS) {
      return { error: `Demo limit: max ${DEMO_MAX_CARDS} cards. Sign up for unlimited cards!` };
    }
    const id = uid();
    const listCards = cards.filter((c) => c.listId === listId);
    const order = String.fromCharCode(97 + listCards.length); // a, b, c...
    const priorities: DemoCard["priority"][] = ["MEDIUM", "HIGH", "LOW", "URGENT"];
    const newCard: DemoCard = {
      id,
      title,
      listId,
      boardId,
      order,
      priority: priorities[cards.length % priorities.length],
    };
    set((s) => ({ cards: [...s.cards, newCard] }));
    return {};
  },

  deleteCard: (cardId: string) => {
    set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) }));
  },

  moveCard: (cardId: string, toListId: string, newOrder: string) => {
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId ? { ...c, listId: toListId, order: newOrder } : c
      ),
    }));
  },

  reorderCards: (listId: string, orderedIds: string[]) => {
    set((s) => ({
      cards: s.cards.map((c) => {
        if (c.listId !== listId) return c;
        const idx = orderedIds.indexOf(c.id);
        if (idx === -1) return c;
        return { ...c, order: String.fromCharCode(97 + idx) };
      }),
    }));
  },

  moveCardToList: (cardId: string, _fromListId: string, toListId: string, index: number) => {
    set((s) => ({
      cards: s.cards.map((c) =>
        c.id === cardId
          ? { ...c, listId: toListId, order: String.fromCharCode(97 + index) }
          : c
      ),
    }));
  },

  getBoardLists: (boardId: string) => {
    return get().lists
      .filter((l) => l.boardId === boardId)
      .sort((a, b) => a.order.localeCompare(b.order));
  },

  getListCards: (listId: string) => {
    return get().cards
      .filter((c) => c.listId === listId)
      .sort((a, b) => a.order.localeCompare(b.order));
  },

  getTotalCardCount: () => get().cards.length,
}));
