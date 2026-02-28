"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamic import breaks the static module graph between RootLayout and the
// server-action stubs (actions/data:xxxx) that live inside card-modal.
// Without this, Turbopack eagerly evaluates the stub chunk at layout boot time.
// On any HMR update the old chunk hash is invalidated before the new factory
// is registered, producing:
//   "module factory is not available. It might have been deleted in an HMR update."
// With ssr:false the chunk is lazy-loaded only when the modal is first needed,
// so each HMR cycle loads the latest factory — no stale reference.
const CardModal = dynamic(
  () => import("@/components/modals/card-modal").then((m) => ({ default: m.CardModal })),
  { ssr: false }
);

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <CardModal />
    </>
  );
};