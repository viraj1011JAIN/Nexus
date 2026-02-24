/**
 * TASK-026 — Import / Export
 *
 * Server actions for:
 *   exportBoardAsJSON  — full board snapshot (lists + cards + labels + checklists)
 *   exportBoardAsCSV   — flat CSV of all cards
 *   importFromJSON     — restore a board from a Nexus JSON export
 *   importFromTrello   — import a Trello board export (trello-export.json)
 */

"use server";

import { auth }   from "@clerk/nextjs/server";
import { db }     from "@/lib/db";
import { revalidatePath } from "next/cache";

// ─── Export: JSON ─────────────────────────────────────────────────────────────

export async function exportBoardAsJSON(boardId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const board = await db.board.findFirst({
    where: { id: boardId, orgId },
    include: {
      lists: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            include: {
              labels: { include: { label: { select: { name: true, color: true } } } },
              checklists: {
                include: { items: { orderBy: { order: "asc" } } },
              },
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!board) return { error: "Board not found." };

  const snapshot = {
    __nexusExport: "v1",
    exportedAt: new Date().toISOString(),
    board: {
      title:     board.title,
      imageUrl:  board.imageThumbUrl,
      lists: board.lists.map((l) => ({
        title: l.title,
        cards: l.cards.map((c) => ({
          title:        c.title,
          description:  c.description,
          priority:     c.priority,
          dueDate:      c.dueDate,
          startDate:    c.startDate,
          storyPoints:  c.storyPoints,
          labels:       c.labels.map((la) => ({ name: la.label.name, color: la.label.color })),
          checklists:   c.checklists.map((cl) => ({
            title: cl.title,
            items: cl.items.map((it) => ({ text: it.title, checked: it.isComplete })),
          })),
          assigneeName: c.assignee?.name ?? null,
        })),
      })),
    },
  };

  return { data: snapshot };
}

// ─── Export: CSV ──────────────────────────────────────────────────────────────

export async function exportBoardAsCSV(boardId: string) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const board = await db.board.findFirst({
    where: { id: boardId, orgId },
    include: {
      lists: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            include: {
              assignee:         { select: { name: true } },
              labels: { include: { label: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  if (!board) return { error: "Board not found." };

  const esc = (v: string | null | undefined) =>
    `"${(v ?? "").replace(/"/g, '""')}"`;

  const header = ["List", "Card Title", "Priority", "Due Date", "Assignee", "Labels", "Description"];
  const rows   = [header.map(esc).join(",")];

  for (const list of board.lists) {
    for (const card of list.cards) {
      rows.push([
        esc(list.title),
        esc(card.title),
        esc(card.priority),
        esc(card.dueDate?.toISOString().slice(0, 10) ?? ""),
        esc(card.assignee?.name ?? ""),
        esc(card.labels.map((la) => la.label.name).join("; ")),
        esc(card.description ?? ""),
      ].join(","));
    }
  }

  return { data: rows.join("\n"), filename: `${board.title.replace(/[^a-z0-9]/gi, "-")}-export.csv` };
}

// ─── Import: Nexus JSON ────────────────────────────────────────────────────────

interface NexusCardImport {
  title: string;
  description?: string | null;
  priority?: string;
  dueDate?: string | null;
  storyPoints?: number | null;
  checklists?: { title: string; items: { text: string; checked: boolean }[] }[];
}

interface NexusListImport { title: string; cards: NexusCardImport[] }
interface NexusBoardImport { title: string; imageUrl?: string; lists: NexusListImport[] }
interface NexusExport     { __nexusExport: "v1"; board: NexusBoardImport }

export async function importFromJSON(payload: unknown): Promise<{ data?: { boardId: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const exp = payload as NexusExport;
  if (exp?.__nexusExport !== "v1" || !exp.board?.title) {
    return { error: "Invalid Nexus export file." };
  }

  const board = await db.board.create({
    data: {
      title:        `${exp.board.title} (imported)`,
      orgId,
      imageId:      "imported",
      imageLinkHTML: "",
      imageUserName: "",
    },
  });

  for (let li = 0; li < exp.board.lists.length; li++) {
    const listData = exp.board.lists[li];
    const list = await db.list.create({
      data: { title: listData.title, boardId: board.id, order: String(li).padStart(6, "0") },
    });

    for (let ci = 0; ci < listData.cards.length; ci++) {
      const c = listData.cards[ci];
      const card = await db.card.create({
        data: {
          title:       c.title,
          description: c.description ?? undefined,
          priority:    ["URGENT","HIGH","MEDIUM","LOW"].includes(c.priority ?? "")
            ? (c.priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW")
            : "MEDIUM",
          dueDate:     c.dueDate ? new Date(c.dueDate) : undefined,
          storyPoints: c.storyPoints ?? undefined,
          listId:      list.id,
          order:       String(ci).padStart(6, "0"),
        },
      });

      for (const cl of c.checklists ?? []) {
        const checklist = await db.checklist.create({
          data: { title: cl.title, cardId: card.id },
        });
        for (let ii = 0; ii < cl.items.length; ii++) {
          await db.checklistItem.create({
            data: {
              title:       cl.items[ii].text,
              isComplete:  cl.items[ii].checked,
              checklistId: checklist.id,
              order:       String(ii).padStart(6, "0"),
            },
          });
        }
      }
    }
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: { boardId: board.id } };
}

// ─── Import: Trello ────────────────────────────────────────────────────────────

interface TrelloCard  { name: string; desc?: string; due?: string | null; closed: boolean; idList: string }
interface TrelloList  { id: string; name: string; closed: boolean }
interface TrelloBoard { name: string; lists: TrelloList[]; cards: TrelloCard[] }

export async function importFromTrello(payload: unknown): Promise<{ data?: { boardId: string }; error?: string }> {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) return { error: "Unauthorized" };

  const trello = payload as TrelloBoard;
  if (!trello?.name || !Array.isArray(trello.lists)) {
    return { error: "Invalid Trello export file." };
  }

  const board = await db.board.create({
    data: {
      title:         `${trello.name} (from Trello)`,
      orgId,
      imageId:       "trello-import",
      imageLinkHTML: "",
      imageUserName: "",
    },
  });

  const listIdMap: Record<string, string> = {};
  const activeLists = trello.lists.filter((l) => !l.closed);

  for (let i = 0; i < activeLists.length; i++) {
    const tl = activeLists[i];
    const list = await db.list.create({
      data: { title: tl.name, boardId: board.id, order: String(i).padStart(6, "0") },
    });
    listIdMap[tl.id] = list.id;
  }

  const activeCards = trello.cards.filter((c) => !c.closed);
  const cardsByList: Record<string, TrelloCard[]> = {};
  for (const card of activeCards) {
    if (!listIdMap[card.idList]) continue;
    if (!cardsByList[card.idList]) cardsByList[card.idList] = [];
    cardsByList[card.idList].push(card);
  }

  for (const [trelloListId, cards] of Object.entries(cardsByList)) {
    const nexusListId = listIdMap[trelloListId];
    for (let ci = 0; ci < cards.length; ci++) {
      const c = cards[ci];
      await db.card.create({
        data: {
          title:       c.name,
          description: c.desc ?? undefined,
          dueDate:     c.due ? new Date(c.due) : undefined,
          listId:      nexusListId,
          order:       String(ci).padStart(6, "0"),
        },
      });
    }
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: { boardId: board.id } };
}
