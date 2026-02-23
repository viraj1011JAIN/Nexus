import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { MentionList, type MentionUser, type MentionListRef } from "./mention-list";

/**
 * Factory — call once per editor instance so each editor has its own debounce
 * timer, preventing cross-editor race conditions when multiple editors coexist.
 */
export function createMentionSuggestion(): Partial<SuggestionOptions<MentionUser>> {
  // Timer is scoped to this suggestion config instance, not the module.
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    char: "@",
    allowSpaces: false,

    items: async ({ query }: { query: string }): Promise<MentionUser[]> => {
      // Debounce network fetch
      if (debounceTimer) clearTimeout(debounceTimer);

      return new Promise((resolve) => {
        debounceTimer = setTimeout(async () => {
          try {
            const url = `/api/members?query=${encodeURIComponent(query)}`;
            const res = await fetch(url);
            if (!res.ok) return resolve([]);
            const data: MentionUser[] = await res.json();
            resolve(data);
          } catch {
            resolve([]);
          }
        }, 200);
      });
    },

    render: () => {
      let renderer: ReactRenderer<MentionListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart(props) {
        renderer = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
          appendTo: () => document.body,
          content: renderer.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },

      onUpdate(props) {
        renderer?.updateProps(props);

        if (!props.clientRect || !popup?.[0]) return;
        popup[0].setProps({
          getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
        });
      },

      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup?.[0]?.hide();
          return true;
        }
        return renderer?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        renderer?.destroy();
      },
    };
  },
  };
}

// Convenience singleton for single-editor use-cases.
export const mentionSuggestion = createMentionSuggestion();
