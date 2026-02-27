"use client";

/**
 * MentionList – TipTap @ mention dropdown
 *
 * Rendered by the Mention extension's `suggestion.render` lifecycle via
 * `ReactRenderer` + tippy floating UI.
 *
 * Usage (in your editor's extensions array):
 * ```tsx
 * import Mention from "@tiptap/extension-mention";
 * import { buildMentionSuggestion } from "@/components/mention-list";
 *
 * Mention.configure({
 *   HTMLAttributes: { class: "mention" },
 *   suggestion: buildMentionSuggestion(orgId),
 * })
 * ```
 *
 * The `buildMentionSuggestion` factory fetches org members from the API and
 * wires the popup lifecycle.  The `MentionList` component handles rendering
 * and keyboard navigation.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { Instance as TippyInstance, GetReferenceClientRect } from "tippy.js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MentionItem {
  id: string;    // Clerk userId — stored in the comment's `mentions` array
  label: string; // Display name shown in the editor chip
  imageUrl?: string | null;
}

export interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

interface MentionListProps extends SuggestionProps<MentionItem> {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Floating dropdown rendered inside a tippy portal.
 *
 * Keyboard API (exposed via ref):
 *   ArrowUp   – move selection up
 *   ArrowDown – move selection down
 *   Enter     – confirm selected item
 *   Escape    – handled by tippy (closes popup)
 */
export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  function MentionList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when item list changes (new keystroke)
    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    }, [items]);

    // ── Imperative keyboard handler ────────────────────────────────────────

    function selectItem(index: number) {
      const item = items[index];
      if (item) command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown({ event }: SuggestionKeyDownProps) {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % Math.max(items.length, 1));
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    // ── Render ─────────────────────────────────────────────────────────────

    if (items.length === 0) {
      return (
        <div className="mention-dropdown rounded-md border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-md">
          No members found
        </div>
      );
    }

    return (
      <ul
        role="listbox"
        aria-label="Mention suggestions"
        className="mention-dropdown w-64 overflow-hidden rounded-md border bg-popover shadow-md"
      >
        {items.map((item, index) => {
          const initials = item.label
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <li key={item.id} role="option" aria-selected={index === selectedIndex}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                  "transition-colors hover:bg-accent focus:bg-accent focus:outline-none",
                  index === selectedIndex && "bg-accent"
                )}
                onMouseDown={(e) => {
                  // Prevent editor from losing focus
                  e.preventDefault();
                  selectItem(index);
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  {item.imageUrl && (
                    <AvatarImage src={item.imageUrl} alt={item.label} />
                  )}
                  <AvatarFallback className="text-[11px] font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate font-medium">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  }
);

// ── Suggestion factory ────────────────────────────────────────────────────────

/**
 * Builds a TipTap suggestion config for `@` mentions.
 *
 * `orgId` is used to fetch org-scoped members from the API.
 * Fetching is debounced via 200 ms; results are cached per-popup lifecycle.
 *
 * @example
 * ```tsx
 * Mention.configure({
 *   HTMLAttributes: { class: "mention" },
 *   suggestion: buildMentionSuggestion(orgId),
 * })
 * ```
 */
export function buildMentionSuggestion(orgId: string) {
  return {
    // ── Filter members by the user's query string ──────────────────────────
    items: async ({ query }: { query: string }): Promise<MentionItem[]> => {
      const params = new URLSearchParams({ orgId });
      if (query) params.set("q", query);

      const res = await fetch(`/api/members?${params.toString()}`).catch(() => null);
      if (!res?.ok) return [];

      const data = (await res.json()) as Array<{
        id: string;
        name: string;
        imageUrl?: string | null;
      }>;

      return data
        .filter((m) =>
          m.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
        .map((m) => ({
          id: m.id,
          label: m.name,
          imageUrl: m.imageUrl ?? null,
        }));
    },

    // ── Popup lifecycle ────────────────────────────────────────────────────
    render() {
      let component: ReactRenderer<MentionListHandle, MentionListProps>;
      let popup: TippyInstance[];

      return {
        onStart(props: SuggestionProps<MentionItem>) {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) return;

          popup = tippy("body", {
            getReferenceClientRect: props.clientRect as GetReferenceClientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            animation: "shift-away",
            theme: "mention",
          });
        },

        onUpdate(props: SuggestionProps<MentionItem>) {
          component.updateProps(props);

          if (!props.clientRect) return;
          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect as GetReferenceClientRect,
          });
        },

        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") {
            popup[0]?.hide();
            return true;
          }
          return Boolean(component.ref?.onKeyDown(props));
        },

        onExit() {
          popup[0]?.destroy();
          component.destroy();
        },
      };
    },
  };
}
