"use client";

import { Toaster as Sonner } from "sonner";

export const Toaster = () => {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: "white",
          color: "rgb(15 23 42)",
          border: "1px solid rgb(226 232 240)",
        },
        className: "shadow-lg",
        duration: 3000,
      }}
    />
  );
};
