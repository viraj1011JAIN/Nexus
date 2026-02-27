/**
 * @jest-environment node
 *
 * SECTION 16 — Real-Time Presence Tests
 *
 * Covers:
 *   16.1  Channel naming — org:orgId:board:boardId
 *   16.2  Presence channel — org:orgId:presence:boardId
 *   16.3  Analytics channel naming
 *   16.4  Org-level channels (boards, activity)
 *   16.5  extractOrgIdFromChannel utility
 *   16.6  assertChannelBelongsToOrg — tenant isolation guard
 *   16.7  ErrorBoundary error handling (class component behavior)
 */

import {
  boardChannel,
  boardPresenceChannel,
  boardAnalyticsChannel,
  orgBoardsChannel,
  orgActivityChannel,
  extractOrgIdFromChannel,
  assertChannelBelongsToOrg,
} from "@/lib/realtime-channels";

const ORG_A = "org_aaaa";
const ORG_B = "org_bbbb";
const BOARD_ID = "board_1234";

describe("Section 16 — Realtime Presence", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 16.1 — Channel naming conventions
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.1 Board channel naming", () => {
    it("16.1 should include orgId and boardId in board channel", () => {
      const ch = boardChannel(ORG_A, BOARD_ID);
      expect(ch).toBe(`org:${ORG_A}:board:${BOARD_ID}`);
    });

    it("16.2 board channel always starts with org: prefix", () => {
      const ch = boardChannel(ORG_A, BOARD_ID);
      expect(ch).toMatch(/^org:/);
    });

    it("16.3 different orgs produce different channel names", () => {
      const ch1 = boardChannel(ORG_A, BOARD_ID);
      const ch2 = boardChannel(ORG_B, BOARD_ID);
      expect(ch1).not.toBe(ch2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.2 — Presence channel
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.2 Presence channel", () => {
    it("16.4 should include orgId:presence:boardId", () => {
      const ch = boardPresenceChannel(ORG_A, BOARD_ID);
      expect(ch).toBe(`org:${ORG_A}:presence:${BOARD_ID}`);
    });

    it("16.5 presence channel is distinct from data channel", () => {
      const dataCh = boardChannel(ORG_A, BOARD_ID);
      const presCh = boardPresenceChannel(ORG_A, BOARD_ID);
      expect(dataCh).not.toBe(presCh);
    });

    it("16.6 presence channel contains :presence: segment", () => {
      const ch = boardPresenceChannel(ORG_A, BOARD_ID);
      expect(ch).toContain(":presence:");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.3 — Analytics channel
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.3 Analytics channel", () => {
    it("16.7 should include orgId:analytics:boardId", () => {
      const ch = boardAnalyticsChannel(ORG_A, BOARD_ID);
      expect(ch).toBe(`org:${ORG_A}:analytics:${BOARD_ID}`);
    });

    it("16.8 analytics channel distinct from board + presence", () => {
      const anal = boardAnalyticsChannel(ORG_A, BOARD_ID);
      const data = boardChannel(ORG_A, BOARD_ID);
      const pres = boardPresenceChannel(ORG_A, BOARD_ID);
      expect(new Set([anal, data, pres]).size).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.4 — Org-level channels
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.4 Org-level channels", () => {
    it("16.9 orgBoardsChannel contains org:orgId:boards", () => {
      expect(orgBoardsChannel(ORG_A)).toBe(`org:${ORG_A}:boards`);
    });

    it("16.10 orgActivityChannel contains org:orgId:activity", () => {
      expect(orgActivityChannel(ORG_A)).toBe(`org:${ORG_A}:activity`);
    });

    it("16.11 org channels for different orgs are isolated", () => {
      expect(orgBoardsChannel(ORG_A)).not.toBe(orgBoardsChannel(ORG_B));
      expect(orgActivityChannel(ORG_A)).not.toBe(orgActivityChannel(ORG_B));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.5 — extractOrgIdFromChannel
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.5 extractOrgIdFromChannel", () => {
    it("16.12 extracts orgId from board channel", () => {
      const ch = boardChannel(ORG_A, BOARD_ID);
      expect(extractOrgIdFromChannel(ch)).toBe(ORG_A);
    });

    it("16.13 extracts orgId from presence channel", () => {
      const ch = boardPresenceChannel(ORG_A, BOARD_ID);
      expect(extractOrgIdFromChannel(ch)).toBe(ORG_A);
    });

    it("16.14 extracts orgId from org boards channel", () => {
      expect(extractOrgIdFromChannel(orgBoardsChannel(ORG_B))).toBe(ORG_B);
    });

    it("16.15 returns null for malformed channel", () => {
      expect(extractOrgIdFromChannel("invalid-channel")).toBeNull();
      expect(extractOrgIdFromChannel("")).toBeNull();
    });

    it("16.16 returns null for channels without org: prefix", () => {
      expect(extractOrgIdFromChannel("board:1234")).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.6 — assertChannelBelongsToOrg
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.6 assertChannelBelongsToOrg — tenant isolation", () => {
    it("16.17 should not throw when channel belongs to correct org", () => {
      const ch = boardChannel(ORG_A, BOARD_ID);
      expect(() => assertChannelBelongsToOrg(ch, ORG_A)).not.toThrow();
    });

    it("16.18 should throw when channel belongs to different org", () => {
      const ch = boardChannel(ORG_A, BOARD_ID);
      expect(() => assertChannelBelongsToOrg(ch, ORG_B)).toThrow(
        /channel isolation violation/i
      );
    });

    it("16.19 should throw for org boards channel with wrong org", () => {
      const ch = orgBoardsChannel(ORG_A);
      expect(() => assertChannelBelongsToOrg(ch, ORG_B)).toThrow();
    });

    it("16.20 prevents cross-tenant subscription at application layer", () => {
      // User from Org B cannot subscribe to Org A's board channel
      const orgAChannel = boardChannel(ORG_A, "board-secret");
      expect(() => assertChannelBelongsToOrg(orgAChannel, ORG_B)).toThrow();
      // But Org A can
      expect(() => assertChannelBelongsToOrg(orgAChannel, ORG_A)).not.toThrow();
    });
  });

  // NOTE: 16.7 (ErrorBoundaryRealtime) — the previous tests in this section
  // exercised locally-defined state logic rather than the real component and
  // have been removed to avoid misleading coverage. ErrorBoundaryRealtime
  // should be tested via React Testing Library in a jsdom environment test file
  // (e.g., __tests__/unit/realtime/error-boundary-realtime.test.tsx).

  // ═══════════════════════════════════════════════════════════════════════════
  // 16.8 — Channel pattern consistency
  // ═══════════════════════════════════════════════════════════════════════════

  describe("16.8 Channel pattern consistency", () => {
    it("16.24 all channels follow org:orgId:type:entityId pattern", () => {
      const pattern = /^org:[^:]+:[^:]+(?::[^:]+)?$/;
      expect(boardChannel(ORG_A, BOARD_ID)).toMatch(pattern);
      expect(boardPresenceChannel(ORG_A, BOARD_ID)).toMatch(pattern);
      expect(boardAnalyticsChannel(ORG_A, BOARD_ID)).toMatch(pattern);
      expect(orgBoardsChannel(ORG_A)).toMatch(pattern);
      expect(orgActivityChannel(ORG_A)).toMatch(pattern);
    });

    it("16.25 boardChannel throws when orgId contains the ':' delimiter", () => {
      // orgIds sourced from Clerk should never contain ':', but if one does the
      // channel factory must reject it rather than embed it verbatim and corrupt
      // the channel namespace (which uses ':' as a separator).
      const specialOrg = "org:with:colons";
      expect(() => boardChannel(specialOrg, BOARD_ID)).toThrow(/orgId.*must not contain/i);
    });
  });
});
