/**
 * CollaborativeRichTextEditor
 * ───────────────────────────
 * Drop-in replacement for `RichTextEditor` that adds real-time CRDT
 * collaborative editing powered by Yjs + Supabase Realtime broadcast.
 *
 * Key differences from `RichTextEditor`
 * ──────────────────────────────────────
 * 1. Accepts `orgId` and `cardId` props to namespace the Supabase channel.
 * 2. Uses `@tiptap/extension-collaboration` (backed by a `Y.Doc`) instead of
 *    TipTap's built-in history, enabling concurrent edits to merge without
 *    data loss.
 * 3. A `SupabaseYjsProvider` is created on mount and torn down on unmount.
 *    It synchronises the Y.Doc with any other browser tab/user editing the
 *    same card via Supabase Realtime broadcast messages.
 * 4. On first render the component waits up to 400 ms for a remote peer to
 *    supply initial content.  If no peer responds the existing HTML from the
 *    database (the `content` prop) is written into the Y.Doc as a seed so the
 *    description is never blank for the first user who opens the modal.
 *
 * All other behaviour — debounced auto-save, blur save, character count,
 * toolbar, cancel — is identical to `RichTextEditor` so callers need only
 * add `orgId` and `cardId`.
 *
 * IMPORTANT: render this component with `key={cardId}` at the call site so
 * React tears down and recreates the component (and its Y.Doc / provider)
 * whenever the user switches to a different card.
 */
"use client";

import "@/app/editor.css";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Collaboration from "@tiptap/extension-collaboration";
import { useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor/editor-toolbar";
import { createClient } from "@/lib/supabase/client";
import { cardYjsChannel } from "@/lib/realtime-channels";
import { SupabaseYjsProvider } from "@/lib/yjs-supabase-provider";

// ── Props ─────────────────────────────────────────────────────────────────

interface CollaborativeRichTextEditorProps {
  /**
   * Initial HTML content loaded from the database.
   * Used to seed the Y.Doc on first open when no peer is online.
   */
  content: string;
  /** Called with the current HTML string after every debounced edit. */
  onSave: (content: string) => Promise<void>;
  /** Clerk organisation ID — used to namespace the Supabase channel. */
  orgId: string;
  /** Card ID — combined with orgId to form the Y.js broadcast channel name. */
  cardId: string;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
  showToolbar?: boolean;
  className?: string;
  enableAutoSave?: boolean;
  onCancel?: () => void;
  characterLimit?: number;
}

// ── Static lookup used to avoid dynamic Tailwind class generation ─────────

const MIN_HEIGHT_MAP: Record<string, string> = {
  "180px": "min-h-[180px]",
  "200px": "min-h-[200px]",
};

// ── Component ─────────────────────────────────────────────────────────────

export function CollaborativeRichTextEditor({
  content,
  onSave,
  orgId,
  cardId,
  placeholder = "Add a description... Type '/' for commands",
  editable = true,
  minHeight = "200px",
  showToolbar = true,
  className,
  enableAutoSave = true,
  onCancel,
  characterLimit = 10000,
}: CollaborativeRichTextEditorProps) {
  // ── Y.Doc — one instance for the lifetime of this component mount ────────
  // The `key={cardId}` at the call site in the card modal guarantees this
  // component unmounts/remounts whenever the active card changes, so the
  // ydoc is always scoped to exactly one card.
  const ydoc = useMemo(() => new Y.Doc(), []); // [] intentional — lives with the component

  // ── Refs shared between save logic and effects ────────────────────────
  const lastSavedContentRef = useRef(content);
  const isInternalUpdate = useRef(false);
  // Tracks the seed timeout so it can be cancelled if a peer responds first
  const seedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── TipTap editor ────────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // TipTap v3 removed the history extension from StarterKit.
      // The Collaboration extension provides Y.js-based undo/redo automatically.
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: {
          HTMLAttributes: {
            class: "bg-muted rounded-md p-4 font-mono text-sm border border-border",
          },
        },
      }),
      // CRDT sync — binds the TipTap document to the shared Y.Doc
      Collaboration.configure({
        document: ydoc,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer",
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-lg max-w-75 max-h-75 h-auto",
        },
      }),
      TaskList.configure({
        HTMLAttributes: { class: "not-prose pl-0" },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: { class: "flex items-start gap-2" },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      CharacterCount.configure({ limit: characterLimit }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: "bg-yellow-200 dark:bg-yellow-700 px-1 rounded",
        },
      }),
    ],
    // Do NOT pass `content` here — the Collaboration extension owns the
    // document model via the Y.Doc.  Initial content is seeded in the
    // effect below after allowing time for a remote peer to sync first.
    editable,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3",
          "text-foreground",
          className,
        ),
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }
      const currentContent = editor.getHTML();
      if (enableAutoSave && currentContent !== lastSavedContentRef.current) {
        debouncedSave(currentContent);
      }
    },
  });

  // ── Supabase Yjs provider — mount/unmount with component ──────────────
  useEffect(() => {
    const supabase = createClient();
    const channelName = cardYjsChannel(orgId, cardId);
    const channel = supabase.channel(channelName);
    const provider = new SupabaseYjsProvider(ydoc, channel);

    return () => {
      provider.destroy();
      ydoc.destroy();
    };
    // ydoc is stable for the component lifetime (created in useMemo with [])
     
  }, [orgId, cardId, ydoc]);

  // ── Initial content seeding ───────────────────────────────────────────
  // Wait up to 400 ms for an online peer to send us their Y.Doc state via the
  // sync handshake.  If no peer responds (first user, or offline), fall back
  // to the HTML content from the database so the description is not blank.
  useEffect(() => {
    if (!editor || !content) return;

    seedTimerRef.current = setTimeout(() => {
      // `editor.isEmpty` is true only when the Y.Doc's XML fragment is empty —
      // i.e. no peer has sent us their state yet.
      if (editor.isEmpty) {
        isInternalUpdate.current = true;
        editor.commands.setContent(content);
        lastSavedContentRef.current = content;
      }
    }, 400);

    return () => {
      if (seedTimerRef.current !== null) {
        clearTimeout(seedTimerRef.current);
      }
    };
    // Run only on the initial editor creation — content changes while editing
    // should NOT re-trigger seeding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // ── Debounced auto-save ───────────────────────────────────────────────
  const debouncedSave = useDebouncedCallback(async (html: string) => {
    if (html === lastSavedContentRef.current) return;
    try {
      isInternalUpdate.current = true;
      await onSave(html);
      lastSavedContentRef.current = html;
    } catch (error) {
      isInternalUpdate.current = false;
      console.error("[CollaborativeRichTextEditor] Auto-save error:", error);
    }
  }, 2000);

  // ── Manual save ───────────────────────────────────────────────────────
  const handleManualSave = async () => {
    if (!editor) return;
    const html = editor.getHTML();
    if (html === lastSavedContentRef.current) return;
    try {
      isInternalUpdate.current = true;
      await onSave(html);
      lastSavedContentRef.current = html;
    } catch (error) {
      isInternalUpdate.current = false;
      console.error("[CollaborativeRichTextEditor] Manual save error:", error);
    }
  };

  // ── Blur handler ──────────────────────────────────────────────────────
  const handleBlur = async (e: React.FocusEvent) => {
    if (!enableAutoSave && editor) {
      const currentContent = editor.getHTML();
      if (currentContent !== lastSavedContentRef.current) {
        setTimeout(async () => {
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (!relatedTarget || !relatedTarget.closest(".rich-text-container")) {
            await handleManualSave();
          }
        }, 200);
      }
    }
  };

  // ── Cancel handler ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCancel = async () => {
    if (editor) {
      const currentContent = editor.getHTML();
      if (currentContent !== lastSavedContentRef.current) {
        await handleManualSave();
      }
    }
    onCancel?.();
  };

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (!editor) {
    return (
      <div className="space-y-2">
        <div className="border border-border rounded-lg overflow-hidden bg-muted/30 animate-pulse">
          <div className="h-10 bg-muted/50 border-b border-border" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-muted/50 rounded w-3/4" />
            <div className="h-4 bg-muted/50 rounded w-1/2" />
            <div className="h-4 bg-muted/50 rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  const charCount = editor.storage.characterCount.characters();
  const isNearLimit = charCount > characterLimit * 0.9;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="rich-text-container" onBlur={handleBlur}>
      <div
        className={cn(
          "border border-border rounded-lg overflow-hidden",
          "focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30",
          "bg-background transition-colors duration-150",
          MIN_HEIGHT_MAP[minHeight ?? "200px"],
        )}
      >
        <EditorContent editor={editor} />
        {showToolbar && editable && (
          <div className="border-t border-border bg-muted/30 px-2 py-1.5">
            <EditorToolbar editor={editor} />
          </div>
        )}
      </div>

      {editable && (
        <div className="flex items-center justify-end text-xs mt-1">
          <div
            className={cn(
              "text-muted-foreground",
              isNearLimit && "text-amber-600 dark:text-amber-400 font-medium",
            )}
          >
            <span>
              {charCount.toLocaleString()} / {characterLimit.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollaborativeRichTextEditor;
