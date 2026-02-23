/**
 * TASK-030 — Public Shared Board Route
 *
 * Security model:
 *  - No authentication required (unauthenticated users can view public share links).
 *  - Token-scoped DB query: only the board attached to this share token is returned.
 *  - Expired or revoked shares → 404.
 *  - Password-protected shares → render PasswordGate (client component) instead of
 *    the board view so the raw board data is never sent to the browser before the
 *    password is verified.  The PasswordGate calls getSharedBoardData again from the
 *    client with the entered password; the server action only returns board data after
 *    a correct bcrypt comparison — no race condition or auth bypass.
 */

import { db } from "@/lib/db";
import { SharedBoardView } from "@/components/board/shared-board-view";
import { PasswordGate } from "./_components/password-gate";
import { notFound } from "next/navigation";

interface SharedBoardPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: SharedBoardPageProps) {
  const { token } = await params;
  // Minimal read — no board data exposed, just the title for the <title> tag
  const share = await db.boardShare.findFirst({
    where: {
      token,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: { board: { select: { title: true } } },
  });
  if (!share) return { title: "Shared Board — Nexus" };
  return {
    title: `${share.board.title} — Shared Board — Nexus`,
    description: `View the shared board: ${share.board.title}`,
    robots: { index: false, follow: false }, // don't index share links
  };
}

export default async function SharedBoardPage({ params }: SharedBoardPageProps) {
  const { token } = await params;

  // Verify the share record is valid (active + not expired) — minimal read
  const share = await db.boardShare.findFirst({
    where: {
      token,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      passwordHash: true,
      allowComments: true,
      allowCopyCards: true,
      viewCount: true,
      board: {
        include: {
          lists: {
            orderBy: { order: "asc" },
            include: {
              cards: {
                orderBy: { order: "asc" },
                include: {
                  assignee: { select: { name: true, imageUrl: true } },
                  labels: { include: { label: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!share) notFound();

  // Password-protected: render the gate in the client without sending board data
  if (share.passwordHash) {
    return (
      <PasswordGate
        token={token}
        boardTitle={share.board.title}
      />
    );
  }

  // Increment view counter (fire-and-forget)
  void db.boardShare
    .update({ where: { id: share.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => {});

  return (
    <SharedBoardView
      board={share.board}
      share={{
        id: share.id,
        allowComments: share.allowComments,
        allowCopyCards: share.allowCopyCards,
        viewCount: share.viewCount + 1,
      }}
    />
  );
}
