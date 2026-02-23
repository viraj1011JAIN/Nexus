"use client";

import { Toaster } from "sonner";

export function SonnerProvider() {
  return (
    <Toaster
      position="top-right"
      richColors
      expand={false}
      duration={3000}
    />
  );
}
