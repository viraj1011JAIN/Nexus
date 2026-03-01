"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import Image from "next/image";

export interface MentionUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

interface MentionListProps {
  items: MentionUser[];
  command: (user: MentionUser) => void;
}

export interface MentionListRef {
  onKeyDown: (opts: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((prev) => (prev + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % props.items.length);
  };

  const enterHandler = () => selectItem(selectedIndex);

  // Reset cursor to top when suggestions change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm text-muted-foreground">
        No members found
      </div>
    );
  }

  return (
    <div className="bg-popover border rounded-lg shadow-lg overflow-hidden min-w-50 max-w-70">
      {props.items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
            index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
          }`}
          onClick={() => selectItem(index)}
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              width={24}
              height={24}
              className="rounded-full shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-semibold text-primary">
                {item.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="font-medium truncate">{item.name}</span>
          <span className="text-[11px] text-muted-foreground ml-auto truncate">{item.email}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";
