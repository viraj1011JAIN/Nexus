"use client";

import { Toaster as Sonner } from "sonner";

export const Toaster = () => {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        className: "shadow-lg !bg-card !text-card-foreground !border-border",
        duration: 3000,
      }}
      style={{ zIndex: 99999 }}
    />
  );
};
