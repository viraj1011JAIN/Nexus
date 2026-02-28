"use client";

import dynamic from "next/dynamic";

// CommandPalette is only needed when the user presses ⌘K / Ctrl+K.
// next/dynamic with ssr:false is only valid inside a Client Component,
// so this thin wrapper owns the dynamic import while layout.tsx stays a
// pure Server Component.
const CommandPalette = dynamic(
  () =>
    import("@/components/command-palette").then((m) => ({
      default: m.CommandPalette,
    })),
  { ssr: false }
);

export function CommandPaletteProvider() {
  return <CommandPalette />;
}
