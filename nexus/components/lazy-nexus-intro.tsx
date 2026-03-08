"use client";

import dynamic from "next/dynamic";

const NexusIntro = dynamic(
  () => import("@/components/nexus-intro").then((m) => m.NexusIntro),
  { ssr: false }
);

export function LazyNexusIntro() {
  return <NexusIntro />;
}
