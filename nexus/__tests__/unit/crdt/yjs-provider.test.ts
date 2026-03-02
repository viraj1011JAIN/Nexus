/**
 * @jest-environment node
 *
 * __tests__/unit/crdt/yjs-provider.test.ts
 *
 * SECTION — Yjs CRDT Collaborative Editing
 *
 * Covers:
 *   C1  encodeUpdate / decodeUpdate — lossless binary ↔ base64 roundtrip
 *   C2  encodeUpdate — handles empty Uint8Array
 *   C3  encodeUpdate — handles large arrays (>1000 bytes)
 *   C4  SupabaseYjsProvider — local Y.Doc update triggers channel.send
 *   C5  SupabaseYjsProvider — local update is base64-encoded in payload
 *   C6  SupabaseYjsProvider — sends yjs-sync-request on SUBSCRIBED
 *   C7  SupabaseYjsProvider — remote update applied to Y.Doc correctly
 *   C8  SupabaseYjsProvider — own echo (same senderId) is ignored
 *   C9  SupabaseYjsProvider — remote updates tagged 'remote' not re-broadcast
 *   C10 SupabaseYjsProvider — sync-request responded with full state
 *   C11 SupabaseYjsProvider — sync-request from own senderId ignored
 *   C12 SupabaseYjsProvider — sync-state applied to Y.Doc
 *   C13 SupabaseYjsProvider — destroy stops local update broadcasting
 *   C14 SupabaseYjsProvider — destroy calls channel.unsubscribe and doc.off
 *   C15 SupabaseYjsProvider — no action taken after destroy
 *   C16 CRDT convergence — two Y.Docs reach identical state after exchange
 *   C17 CRDT idempotency — applying the same update twice is harmless
 *   C18 cardYjsChannel — returns correctly namespaced channel name
 *   C19 cardYjsChannel — throws when orgId contains ':'
 *   C20 cardYjsChannel — throws when cardId is empty
 */

import * as Y from "yjs";
import {
  SupabaseYjsProvider,
  encodeUpdate,
  decodeUpdate,
} from "@/lib/yjs-supabase-provider";
import { cardYjsChannel } from "@/lib/realtime-channels";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Mock RealtimeChannel factory ──────────────────────────────────────────

/**
 * Minimal mock of Supabase RealtimeChannel.
 *
 * The mock captures:
 * - `send` calls (asserted in broadcast tests)
 * - `on` registrations (so we can call them back from tests)
 * - `subscribe` triggers (so we can simulate SUBSCRIBED status)
 */
function makeMockChannel() {
  const broadcastHandlers: Record<string, ((msg: { payload: unknown }) => void)[]> = {};
  let subscribeCallback: ((status: string) => void) | null = null;
  const sendMock = jest.fn().mockResolvedValue(undefined);
  const unsubscribeMock = jest.fn().mockResolvedValue(undefined);

  const channel = {
    send: sendMock,
    unsubscribe: unsubscribeMock,
    on: jest.fn((type: string, filter: { event: string }, handler: (msg: { payload: unknown }) => void) => {
      if (type === "broadcast") {
        if (!broadcastHandlers[filter.event]) {
          broadcastHandlers[filter.event] = [];
        }
        broadcastHandlers[filter.event].push(handler);
      }
      return channel;
    }),
    subscribe: jest.fn((cb?: (status: string) => void) => {
      subscribeCallback = cb ?? null;
      return channel;
    }),
    // Test helpers — not part of the real RealtimeChannel API
    _triggerSubscribed: () => subscribeCallback?.("SUBSCRIBED"),
    _triggerBroadcast: (event: string, payload: unknown) => {
      broadcastHandlers[event]?.forEach((h) => h({ payload }));
    },
    _send: sendMock,
    _unsubscribe: unsubscribeMock,
  } as unknown as RealtimeChannel & {
    _triggerSubscribed: () => void;
    _triggerBroadcast: (event: string, payload: unknown) => void;
    _send: jest.Mock;
    _unsubscribe: jest.Mock;
  };

  return channel;
}

// ─── encode / decode helpers ───────────────────────────────────────────────

describe("encodeUpdate / decodeUpdate", () => {
  it("C1 — lossless roundtrip for arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 127, 128, 200, 255, 42, 99]);
    const encoded = encodeUpdate(original);
    const decoded = decodeUpdate(encoded);
    expect(decoded).toEqual(original);
  });

  it("C2 — handles empty Uint8Array", () => {
    const original = new Uint8Array([]);
    expect(decodeUpdate(encodeUpdate(original))).toEqual(original);
  });

  it("C3 — handles large arrays (1000+ bytes) without call-stack overflow", () => {
    const large = new Uint8Array(1200).map((_, i) => i % 256);
    expect(decodeUpdate(encodeUpdate(large))).toEqual(large);
  });
});

// ─── SupabaseYjsProvider ───────────────────────────────────────────────────

describe("SupabaseYjsProvider", () => {
  let doc: Y.Doc;
  let channel: ReturnType<typeof makeMockChannel>;
  let provider: SupabaseYjsProvider;

  beforeEach(() => {
    doc = new Y.Doc();
    channel = makeMockChannel();
    provider = new SupabaseYjsProvider(doc, channel);
  });

  afterEach(() => {
    provider.destroy();
    doc.destroy();
  });

  // ── C4 — local update triggers send ────────────────────────────────────

  it("C4 — local Y.Doc mutation triggers channel.send with yjs-update", () => {
    channel._triggerSubscribed();
    (channel._send as jest.Mock).mockClear();

    const text = doc.getText("body");
    text.insert(0, "hello");

    expect(channel._send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: "yjs-update",
        payload: expect.objectContaining({ type: "yjs-update", senderId: provider.senderId }),
      }),
    );
  });

  // ── C5 — payload contains base64 string ────────────────────────────────

  it("C5 — broadcast payload.update is a base64 string", () => {
    channel._triggerSubscribed();
    (channel._send as jest.Mock).mockClear();

    doc.getText("body").insert(0, "world");

    const [call] = (channel._send as jest.Mock).mock.calls;
    const payload = call[0].payload as { update: string };
    expect(typeof payload.update).toBe("string");
    // base64 chars only
    expect(payload.update).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  // ── C6 — sync-request on subscribe ─────────────────────────────────────

  it("C6 — sends yjs-sync-request immediately after SUBSCRIBED", () => {
    (channel._send as jest.Mock).mockClear();
    channel._triggerSubscribed();

    expect(channel._send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "broadcast",
        event: "yjs-sync-request",
        payload: expect.objectContaining({
          type: "yjs-sync-request",
          senderId: provider.senderId,
        }),
      }),
    );
  });

  // ── C7 — remote update applied to Y.Doc ────────────────────────────────

  it("C7 — incoming yjs-update is applied to the local Y.Doc", () => {
    const remoteDoc = new Y.Doc();
    remoteDoc.getText("body").insert(0, "remote text");
    const update = Y.encodeStateAsUpdate(remoteDoc);

    channel._triggerBroadcast("yjs-update", {
      type: "yjs-update",
      update: encodeUpdate(update),
      senderId: "other-client",
    });

    expect(doc.getText("body").toString()).toBe("remote text");
    remoteDoc.destroy();
  });

  // ── C8 — own echo ignored ───────────────────────────────────────────────

  it("C8 — own senderId echo is ignored (no double-apply)", () => {
    const remoteDoc = new Y.Doc();
    remoteDoc.getText("body").insert(0, "own echo");
    const update = Y.encodeStateAsUpdate(remoteDoc);

    channel._triggerBroadcast("yjs-update", {
      type: "yjs-update",
      update: encodeUpdate(update),
      senderId: provider.senderId, // same as ours — should be ignored
    });

    expect(doc.getText("body").toString()).toBe("");
    remoteDoc.destroy();
  });

  // ── C9 — remote origin not re-broadcast ────────────────────────────────

  it("C9 — update with origin='remote' is not broadcast back to channel", () => {
    channel._triggerSubscribed();
    (channel._send as jest.Mock).mockClear();

    const remoteDoc = new Y.Doc();
    remoteDoc.getText("body").insert(0, "ping");
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);

    // Simulate receiving a remote update (tagged origin='remote')
    Y.applyUpdate(doc, remoteUpdate, "remote");

    // channel.send should NOT have been called by the local update handler
    const updateCalls = (channel._send as jest.Mock).mock.calls.filter(
      (c) => c[0]?.event === "yjs-update",
    );
    expect(updateCalls).toHaveLength(0);
    remoteDoc.destroy();
  });

  // ── C10 — sync-request responded with state ─────────────────────────────

  it("C10 — sync-request from another client is answered with full state", () => {
    doc.getText("body").insert(0, "doc content");
    (channel._send as jest.Mock).mockClear();

    channel._triggerBroadcast("yjs-sync-request", {
      type: "yjs-sync-request",
      senderId: "requester-99",
    });

    expect(channel._send).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "yjs-sync-state",
        payload: expect.objectContaining({ type: "yjs-sync-state" }),
      }),
    );

    // The state we sent should, when applied to an empty doc, reproduce our content
    const sentPayload = (channel._send as jest.Mock).mock.calls.find(
      (c) => c[0]?.event === "yjs-sync-state",
    )![0].payload as { state: string };
    const emptyDoc = new Y.Doc();
    Y.applyUpdate(emptyDoc, decodeUpdate(sentPayload.state), "remote");
    expect(emptyDoc.getText("body").toString()).toBe("doc content");
    emptyDoc.destroy();
  });

  // ── C11 — own sync-request ignored ──────────────────────────────────────

  it("C11 — own yjs-sync-request is not answered", () => {
    (channel._send as jest.Mock).mockClear();

    channel._triggerBroadcast("yjs-sync-request", {
      type: "yjs-sync-request",
      senderId: provider.senderId, // our own
    });

    const stateCalls = (channel._send as jest.Mock).mock.calls.filter(
      (c) => c[0]?.event === "yjs-sync-state",
    );
    expect(stateCalls).toHaveLength(0);
  });

  // ── C12 — sync-state applied ─────────────────────────────────────────────

  it("C12 — incoming yjs-sync-state is applied to the local Y.Doc", () => {
    const peerDoc = new Y.Doc();
    peerDoc.getText("body").insert(0, "peer initial content");
    const state = Y.encodeStateAsUpdate(peerDoc);

    channel._triggerBroadcast("yjs-sync-state", {
      type: "yjs-sync-state",
      state: encodeUpdate(state),
    });

    expect(doc.getText("body").toString()).toBe("peer initial content");
    peerDoc.destroy();
  });

  // ── C13 — destroy stops broadcasting ────────────────────────────────────

  it("C13 — after destroy, local mutations are no longer broadcast", () => {
    channel._triggerSubscribed();
    provider.destroy();
    (channel._send as jest.Mock).mockClear();

    doc.getText("body").insert(0, "post-destroy edit");

    const updateCalls = (channel._send as jest.Mock).mock.calls.filter(
      (c) => c[0]?.event === "yjs-update",
    );
    expect(updateCalls).toHaveLength(0);
  });

  // ── C14 — destroy cleans up resources ───────────────────────────────────

  it("C14 — destroy calls channel.unsubscribe()", () => {
    provider.destroy();
    expect(channel._unsubscribe).toHaveBeenCalledTimes(1);
  });

  // ── C15 — destroy is idempotent ──────────────────────────────────────────

  it("C15 — calling destroy twice does not double-unsubscribe", () => {
    provider.destroy();
    provider.destroy(); // second call must be a no-op
    expect(channel._unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ─── CRDT convergence ────────────────────────────────────────────────────────

describe("CRDT convergence", () => {
  it("C16 — two Y.Docs reach identical state after exchanging concurrent updates", () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    // Simulate concurrent independent edits
    docA.getText("body").insert(0, "Alice ");
    docB.getText("body").insert(0, " Bob");

    // Exchange updates in both directions (as the provider would via broadcast)
    const updateA = Y.encodeStateAsUpdate(docA);
    const updateB = Y.encodeStateAsUpdate(docB);

    Y.applyUpdate(docA, updateB, "remote");
    Y.applyUpdate(docB, updateA, "remote");

    // Both docs must have converged to the same content
    expect(docA.getText("body").toString()).toBe(docB.getText("body").toString());

    docA.destroy();
    docB.destroy();
  });

  it("C17 — applying the same update twice is idempotent (no duplicate content)", () => {
    const source = new Y.Doc();
    const target = new Y.Doc();

    source.getText("body").insert(0, "idempotent");
    const update = Y.encodeStateAsUpdate(source);

    Y.applyUpdate(target, update, "remote");
    Y.applyUpdate(target, update, "remote"); // apply again

    expect(target.getText("body").toString()).toBe("idempotent");

    source.destroy();
    target.destroy();
  });
});

// ─── cardYjsChannel ─────────────────────────────────────────────────────────

describe("cardYjsChannel", () => {
  it("C18 — returns correctly formatted channel name", () => {
    expect(cardYjsChannel("org_abc123", "card_xyz789")).toBe(
      "org:org_abc123:card:card_xyz789:yjs",
    );
  });

  it("C19 — throws when orgId contains the ':' delimiter", () => {
    expect(() => cardYjsChannel("org:bad", "card_xyz")).toThrow(
      /orgId.*must not contain.*:/i,
    );
  });

  it("C20 — throws when cardId is empty", () => {
    expect(() => cardYjsChannel("org_abc", "")).toThrow(
      /cardId.*must not be empty/i,
    );
  });
});
