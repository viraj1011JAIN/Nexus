"use client";

/**
 * Demo Session Store (Zustand)
 *
 * Manages the timed demo experience:
 *  - Tracks demo start time (persisted in localStorage)
 *  - Counts popup dismissals (max 3)
 *  - After 3 dismissals (30 min total), demo freezes
 *  - Distinguishes guest vs authenticated users for popup variant
 *
 * Timer model:
 *   0–10 min  → free usage
 *  10 min     → popup #1 (dismissable)
 *  20 min     → popup #2 (dismissable)
 *  30 min     → popup #3 (dismissable once, then freeze)
 *  30+ min    → frozen — full-screen overlay, must sign up
 */

import { create } from "zustand";

const STORAGE_KEY_START = "nexus-demo-start";
const STORAGE_KEY_DISMISSALS = "nexus-demo-dismissals";
const STORAGE_KEY_FROZEN = "nexus-demo-frozen";

/** Interval in ms between popups — 10 minutes */
export const DEMO_POPUP_INTERVAL_MS = 10 * 60 * 1000;

/** Max number of popup dismissals before freeze */
export const DEMO_MAX_DISMISSALS = 3;

interface DemoSessionState {
  /** Epoch ms when demo started */
  startTime: number | null;
  /** Number of times the user dismissed the popup */
  dismissCount: number;
  /** Whether the demo is frozen (no more usage) */
  isFrozen: boolean;
  /** Whether the popup is currently visible */
  isPopupVisible: boolean;
  /** Whether the user is authenticated (signed in via Clerk) */
  isAuthenticated: boolean;

  // Actions
  initSession: (isAuthenticated: boolean) => void;
  showPopup: () => void;
  dismissPopup: () => void;
  freeze: () => void;
  resetSession: () => void;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — silently degrade
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

export const useDemoSession = create<DemoSessionState>((set, get) => ({
  startTime: null,
  dismissCount: 0,
  isFrozen: false,
  isPopupVisible: false,
  isAuthenticated: false,

  initSession: (isAuthenticated: boolean) => {
    const existingStart = readStorage<number | null>(STORAGE_KEY_START, null);
    const existingDismissals = readStorage<number>(STORAGE_KEY_DISMISSALS, 0);
    const existingFrozen = readStorage<boolean>(STORAGE_KEY_FROZEN, false);

    const startTime = existingStart ?? Date.now();
    if (!existingStart) {
      writeStorage(STORAGE_KEY_START, startTime);
    }

    set({
      startTime,
      dismissCount: existingDismissals,
      isFrozen: existingFrozen,
      isAuthenticated,
      isPopupVisible: false,
    });
  },

  showPopup: () => {
    const { isFrozen } = get();
    if (isFrozen) return;
    set({ isPopupVisible: true });
  },

  dismissPopup: () => {
    const { dismissCount } = get();
    const newCount = dismissCount + 1;
    writeStorage(STORAGE_KEY_DISMISSALS, newCount);

    if (newCount >= DEMO_MAX_DISMISSALS) {
      // Final dismissal — freeze
      writeStorage(STORAGE_KEY_FROZEN, true);
      set({
        dismissCount: newCount,
        isPopupVisible: false,
        isFrozen: true,
      });
    } else {
      set({
        dismissCount: newCount,
        isPopupVisible: false,
      });
    }
  },

  freeze: () => {
    writeStorage(STORAGE_KEY_FROZEN, true);
    set({ isFrozen: true, isPopupVisible: false });
  },

  resetSession: () => {
    removeStorage(STORAGE_KEY_START);
    removeStorage(STORAGE_KEY_DISMISSALS);
    removeStorage(STORAGE_KEY_FROZEN);
    set({
      startTime: null,
      dismissCount: 0,
      isFrozen: false,
      isPopupVisible: false,
      isAuthenticated: false,
    });
  },
}));
