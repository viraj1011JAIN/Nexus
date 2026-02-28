"use client";

// Editor-specific styles — imported here so they are only loaded when the
// rich-text editor is actually rendered (lazy bundle boundary via card-modal).
import "@/app/editor.css";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { useEffect, useRef, memo } from 'react';
import { useDebouncedCallback } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { EditorToolbar } from './editor/editor-toolbar';
import '@/app/editor.css';

interface RichTextEditorProps {
  content: string;
  onSave: (content: string) => Promise<void>;
  placeholder?: string;
  editable?: boolean;
  minHeight?: string;
  showToolbar?: boolean;
  className?: string;
  enableAutoSave?: boolean;
  onCancel?: () => void;
  characterLimit?: number;
}

export function RichTextEditor({
  content,
  onSave,
  placeholder = 'Add a description... Type "/" for commands',
  editable = true,
  minHeight = '200px',
  showToolbar = true,
  className,
  enableAutoSave = true,
  onCancel,
  characterLimit = 10000,
}: RichTextEditorProps) {
  // Use refs to prevent re-renders during auto-save (no screen blinking)
  const lastSavedContentRef = useRef(content);
  const isInternalUpdate = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'bg-muted rounded-md p-4 font-mono text-sm border border-border',
          },
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4 hover:text-primary/80 cursor-pointer',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-lg max-w-[300px] max-h-[300px] h-auto',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-0',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      CharacterCount.configure({
        limit: characterLimit,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-700 px-1 rounded',
        },
      }),
    ],
    content,
    editable,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3',
          'text-foreground',
          className
        ),
        'data-placeholder': placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      if (isInternalUpdate.current) {
        isInternalUpdate.current = false;
        return;
      }
      const currentContent = editor.getHTML();
      // Silent check - no state updates, no re-renders
      if (enableAutoSave && currentContent !== lastSavedContentRef.current) {
        debouncedSave(currentContent);
      }
    },
  });

  // Debounced auto-save - completely silent with no state updates
  const debouncedSave = useDebouncedCallback(async (html: string) => {
    if (html === lastSavedContentRef.current) return;

    try {
      isInternalUpdate.current = true;
      await onSave(html);
      lastSavedContentRef.current = html; // Use ref - no re-render
    } catch (error) {
      isInternalUpdate.current = false;
      // Silent error handling - log but don't show to user
      console.error('Auto-save error:', error);
    }
  }, 2000);

  // Manual save handler (silent)
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
      console.error('Manual save error:', error);
    }
  };

  // Manual save on blur - silent operation
  const handleBlur = async (e: React.FocusEvent) => {
    if (!enableAutoSave && editor) {
      const currentContent = editor.getHTML();
      if (currentContent !== lastSavedContentRef.current) {
        setTimeout(async () => {
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (!relatedTarget || !relatedTarget.closest('.rich-text-container')) {
            await handleManualSave();
          }
        }, 200);
      }
    }
  };

  // Cancel handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCancel = async () => {
    if (editor) {
      const currentContent = editor.getHTML();
      if (currentContent !== lastSavedContentRef.current) {
        await handleManualSave();
      }
    }
    if (onCancel) {
      onCancel();
    }
  };

  // Sync external content changes (only update if content is different and not from internal edits)
  useEffect(() => {
    // Skip if this is an internal update (from editor changes)
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    // Only update if content actually changed externally
    if (editor && content && content !== lastSavedContentRef.current) {
      const currentEditorContent = editor.getHTML();
      // Avoid setting content if it's already the same (prevent loop)
      if (content !== currentEditorContent) {
        editor.commands.setContent(content);
        lastSavedContentRef.current = content;
      }
    }
  }, [content, editor]); // Removed lastSavedContent from deps

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
  const charLimit = characterLimit;
  const isNearLimit = charCount > charLimit * 0.9;

  return (
    <div className="rich-text-container" onBlur={handleBlur}>
      <div 
        className={cn(
          "border border-border rounded-lg overflow-hidden",
          "focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/30",
          "bg-background transition-colors duration-150"
        )}
        style={{ minHeight }}
      >
        <EditorContent editor={editor} />
        {showToolbar && editable && (
          <div className="border-t border-border bg-muted/30 px-2 py-1.5">
            <EditorToolbar editor={editor} />
          </div>
        )}
      </div>

      {/* Character Count Only - No Save Status */}
      {editable && (
        <div className="flex items-center justify-end text-xs mt-1">
          <div className={cn(
            "text-muted-foreground",
            isNearLimit && "text-amber-600 dark:text-amber-400 font-medium"
          )}>
            <span>
              {charCount.toLocaleString()} / {charLimit.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized version to prevent unnecessary re-renders
export default memo(RichTextEditor);
