/**
 * SupabaseYjsProvider
 * ───────────────────
 * A custom Yjs transport layer that uses Supabase Realtime **broadcast**
 * (fire-and-forget, <100 ms latency) as the wire for exchanging Y.js binary
 * state updates between browser tabs / users editing the same card.
 *
 * Architecture
 * ────────────
 *  ┌────────────┐  Y.Doc update  ┌─────────────────────────┐
 *  │  TipTap    │ ─────────────► │ SupabaseYjsProvider      │
 *  │  editor    │                │  encodeUpdate → base64   │
 *  └────────────┘                │  ─► channel.send(...)    │
 *                                └─────────────────────────┘
 *                                         │ Supabase Realtime Broadcast
 *                                         ▼
 *                                ┌─────────────────────────┐
 *                                │ SupabaseYjsProvider      │ (remote peer)
 *                                │  decodeUpdate ← base64   │
 *                                │  Y.applyUpdate(doc, ...)  │
 *                                └─────────────────────────┘
 *                                         │
 *                                         ▼
 *                                ┌────────────┐
 *                                │  TipTap    │ (remote peer's editor
 *                                │  editor    │  reflects merged state)
 *                                └────────────┘
 *
 * Sync Handshake (on initial subscribe)
 * ──────────────────────────────────────
 * 1. New client subscribes → broadcasts `yjs-sync-request`
 * 2. Any connected peers reply with `yjs-sync-state` (full doc state)
 * 3. New client merges the received state via `Y.applyUpdate()`
 *    → all peers converge to the same CRDT state
 *
 * CRDT Guarantees
 * ───────────────
 * - Updates are commutative and idempotent — applying the same update twice
 *   is harmless (Y.js deduplicates by Lamport timestamp).
 * - Concurrent edits from multiple users ALWAYS merge without data loss.
 * - Replaces the previous last-write-wins `debounced onSave` behaviour for
 *   in-session collaboration (Prisma remains the durable storage layer).
 *
 * Security
 * ────────
 * Channel names are always `org:{orgId}:card:{cardId}:yjs`, constructed by
 * `cardYjsChannel()` in `lib/realtime-channels.ts` which validates that
 * neither segment contains the `:` delimiter.
 */

import * as Y from 'yjs';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Binary ↔ base64 helpers ───────────────────────────────────────────────

/**
 * Safely encodes a `Uint8Array` to a base64 string without hitting the
 * call-stack limit that `String.fromCharCode.apply(null, largeArray)` has
 * for documents > ~65k bytes.
 */
export function encodeUpdate(update: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < update.length; i++) {
    binary += String.fromCharCode(update[i]);
  }
  return globalThis.btoa(binary);
}

/**
 * Decodes a base64 string back to a `Uint8Array` suitable for
 * `Y.applyUpdate()`.
 */
export function decodeUpdate(encoded: string): Uint8Array {
  const binary = globalThis.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Broadcast message types ───────────────────────────────────────────────

interface YjsUpdatePayload {
  type: 'yjs-update';
  /** base64-encoded Y.js binary update */
  update: string;
  /** Sender ID to suppress own-echo processing */
  senderId: string;
}

interface YjsSyncRequestPayload {
  type: 'yjs-sync-request';
  senderId: string;
}

interface YjsSyncStatePayload {
  type: 'yjs-sync-state';
  /** base64-encoded full Y.js document state */
  state: string;
}

type BroadcastPayload =
  | YjsUpdatePayload
  | YjsSyncRequestPayload
  | YjsSyncStatePayload;

// ── Provider ──────────────────────────────────────────────────────────────

/**
 * Bridges a Y.Doc to a Supabase Realtime broadcast channel.
 *
 * @example
 * ```typescript
 * const ydoc    = new Y.Doc();
 * const channel = supabase.channel(cardYjsChannel(orgId, cardId));
 * const provider = new SupabaseYjsProvider(ydoc, channel);
 *
 * // …editor work…
 *
 * // On unmount:
 * provider.destroy();
 * ydoc.destroy();
 * ```
 */
export class SupabaseYjsProvider {
  /**
   * Unique identifier for this client session.
   * Used to suppress processing of our own broadcast echoes.
   */
  readonly senderId: string;

  private _isDestroyed = false;

  constructor(
    private readonly doc: Y.Doc,
    private readonly channel: RealtimeChannel,
  ) {
    this.senderId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Observe all local Y.Doc mutations and forward them to peers
    this.doc.on('update', this._handleLocalUpdate);

    // Subscribe to remote broadcast events
    this.channel
      .on('broadcast', { event: 'yjs-update' }, ({ payload }: { payload: BroadcastPayload }) =>
        this._handleRemoteUpdate(payload as YjsUpdatePayload),
      )
      .on('broadcast', { event: 'yjs-sync-request' }, ({ payload }: { payload: BroadcastPayload }) =>
        this._handleSyncRequest(payload as YjsSyncRequestPayload),
      )
      .on('broadcast', { event: 'yjs-sync-state' }, ({ payload }: { payload: BroadcastPayload }) =>
        this._handleSyncState(payload as YjsSyncStatePayload),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this._isDestroyed) {
          // Ask any connected peer for their full state so we can catch up
          void this.channel.send({
            type: 'broadcast',
            event: 'yjs-sync-request',
            payload: {
              type: 'yjs-sync-request',
              senderId: this.senderId,
            } satisfies YjsSyncRequestPayload,
          });
        }
      });
  }

  // ── Local → remote ────────────────────────────────────────────────────

  private _handleLocalUpdate = (update: Uint8Array, origin: unknown): void => {
    if (this._isDestroyed) return;
    // Do not re-broadcast updates that originated from a remote apply to prevent
    // infinite broadcast loops.
    if (origin === 'remote') return;

    void this.channel.send({
      type: 'broadcast',
      event: 'yjs-update',
      payload: {
        type: 'yjs-update',
        update: encodeUpdate(update),
        senderId: this.senderId,
      } satisfies YjsUpdatePayload,
    });
  };

  // ── Remote → local ────────────────────────────────────────────────────

  private _handleRemoteUpdate = (payload: YjsUpdatePayload): void => {
    if (this._isDestroyed) return;
    // Supabase Realtime broadcast also delivers to the sender — skip own echoes
    if (payload.senderId === this.senderId) return;

    try {
      const update = decodeUpdate(payload.update);
      // Tag the origin as 'remote' so _handleLocalUpdate skips re-broadcasting
      Y.applyUpdate(this.doc, update, 'remote');
    } catch (err) {
      console.error('[SupabaseYjsProvider] Failed to apply remote update', err);
    }
  };

  // ── Sync handshake ────────────────────────────────────────────────────

  private _handleSyncRequest = (payload: YjsSyncRequestPayload): void => {
    if (this._isDestroyed) return;
    // Don't respond to our own request
    if (payload.senderId === this.senderId) return;

    // Reply with our complete document state so the requester can merge it
    const state = Y.encodeStateAsUpdate(this.doc);
    void this.channel.send({
      type: 'broadcast',
      event: 'yjs-sync-state',
      payload: {
        type: 'yjs-sync-state',
        state: encodeUpdate(state),
      } satisfies YjsSyncStatePayload,
    });
  };

  private _handleSyncState = (payload: YjsSyncStatePayload): void => {
    if (this._isDestroyed) return;

    try {
      const state = decodeUpdate(payload.state);
      Y.applyUpdate(this.doc, state, 'remote');
    } catch (err) {
      console.error('[SupabaseYjsProvider] Failed to apply sync state', err);
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Unsubscribes the Supabase channel and stops observing the Y.Doc.
   * Must be called on component unmount to prevent memory leaks.
   */
  destroy(): void {
    if (this._isDestroyed) return;
    this._isDestroyed = true;
    this.doc.off('update', this._handleLocalUpdate);
    void this.channel.unsubscribe();
  }
}
