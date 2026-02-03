"use client";

import { useCallback, memo } from "react";
import { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { EmojiPickerComponent } from "./emoji-picker";
import { GifPicker } from "./gif-picker";
import { LinkPopover } from "./link-popover";
import { ToolbarButton } from "./toolbar-button";

interface EditorToolbarProps {
  editor: Editor;
}

export const EditorToolbar = ({ editor }: EditorToolbarProps) => {
  // Memoize callbacks to prevent child re-renders
  const handleEmojiSelect = useCallback((emoji: string) => {
    editor.chain().focus().insertContent(emoji).run();
  }, [editor]);

  const handleGifSelect = useCallback((gifUrl: string) => {
    editor
      .chain()
      .focus()
      .insertContent(`<img src="${gifUrl}" alt="GIF" class="gif-embed" />`)
      .run();
  }, [editor]);

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-muted/50 border-b border-border flex-wrap">
      {/* Text Formatting */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          tooltip="Bold"
          shortcut="Ctrl+B"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          tooltip="Italic"
          shortcut="Ctrl+I"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={Underline}
          tooltip="Underline"
          shortcut="Ctrl+U"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          icon={Strikethrough}
          tooltip="Strikethrough"
          shortcut="Ctrl+Shift+X"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
          icon={Code}
          tooltip="Inline Code"
          shortcut="Ctrl+E"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          icon={Highlighter}
          tooltip="Highlight"
          shortcut="Ctrl+Shift+H"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Headings */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive("heading", { level: 1 })}
          icon={Heading1}
          tooltip="Heading 1"
          shortcut="Ctrl+Alt+1"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
          icon={Heading2}
          tooltip="Heading 2"
          shortcut="Ctrl+Alt+2"
        />
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
          icon={Heading3}
          tooltip="Heading 3"
          shortcut="Ctrl+Alt+3"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Lists */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={List}
          tooltip="Bullet List"
          shortcut="Ctrl+Shift+8"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={ListOrdered}
          tooltip="Numbered List"
          shortcut="Ctrl+Shift+7"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive("taskList")}
          icon={ListTodo}
          tooltip="Task List"
          shortcut="Ctrl+Shift+9"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          icon={Quote}
          tooltip="Quote"
          shortcut="Ctrl+Shift+>"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Text Alignment */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          icon={AlignLeft}
          tooltip="Align Left"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          icon={AlignCenter}
          tooltip="Align Center"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          icon={AlignRight}
          tooltip="Align Right"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          isActive={editor.isActive({ textAlign: "justify" })}
          icon={AlignJustify}
          tooltip="Justify"
        />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Extras */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          tooltip="Horizontal Rule"
        />
        <LinkPopover editor={editor} />
        <EmojiPickerComponent onSelect={handleEmojiSelect} />
        <GifPicker onSelect={handleGifSelect} />
      </div>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={Undo}
          tooltip="Undo"
          shortcut="Ctrl+Z"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={Redo}
          tooltip="Redo"
          shortcut="Ctrl+Y"
        />
      </div>
    </div>
  );
};

// Export memoized version to prevent unnecessary re-renders
export default memo(EditorToolbar);
