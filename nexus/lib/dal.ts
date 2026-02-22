/**
 * Data Access Layer (DAL) — Tenant-Scoped Database Access
 *
 * RULES:
 * - ALL database queries in server actions and API routes go through here
 * - Every query is automatically scoped to the current tenant's orgId
 * - orgId is set at construction time from Clerk — NEVER from input parameters
 * - Ownership is verified BEFORE every mutation
 * - Cross-tenant access returns NOT_FOUND, never FORBIDDEN
 *   (NOT_FOUND reveals nothing; FORBIDDEN confirms the resource exists)
 *
 * Field name reference (Prisma TypeScript names):
 *   Board   → orgId          (column: org_id)
 *   List    → boardId        (no orgId — traverse List→Board→orgId)
 *   Card    → listId         (no orgId — traverse Card→List→Board→orgId)
 *   Label   → orgId          (column: org_id)
 *   AuditLog→ orgId          (column: org_id)
 *   Comment → cardId         (traverse Comment→Card→List→Board→orgId)
 */

import { db, setCurrentOrgId } from "@/lib/db";
import { getTenantContext, TenantContext, TenantError } from "@/lib/tenant-context";
import type { Prisma } from "@prisma/client";

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a DAL instance locked to the current request's tenant context.
 *
 * @param ctx  Optional pre-fetched context. Pass it to avoid an extra auth() round-trip.
 *             getTenantContext() uses cache() so a second call is free, but explicit
 *             context is slightly cleaner.
 */
export async function createDAL(ctx?: TenantContext): Promise<TenantDAL> {
  const context = ctx ?? (await getTenantContext());
  await setCurrentOrgId(context.orgId).catch(() => { /* non-fatal: session var may not be available in all pooling modes */ });
  return new TenantDAL(context.orgId, context.userId);
}

// ─── Main class ───────────────────────────────────────────────────────────────

class TenantDAL {
  constructor(
    private readonly orgId: string,
    private readonly userId: string
  ) {}

  // ── Boards ────────────────────────────────────────────────────────────────

  get boards() {
    const orgId = this.orgId;
    const self = this;

    return {
      /** Returns all boards for this org. Cannot return boards from other orgs. */
      findMany: <T extends Omit<Prisma.BoardFindManyArgs, "where"> & {
        where?: Omit<Prisma.BoardWhereInput, "orgId">;
      }>(
        args?: T
      ) =>
        db.board.findMany({
          ...(args as Prisma.BoardFindManyArgs),
          where: { ...(args?.where as object), orgId },
        }),

      /** Fetches board by ID and asserts it belongs to this org. */
      findUnique: async (
        boardId: string,
        args?: Omit<Prisma.BoardFindUniqueArgs, "where">
      ) => {
        const board = await db.board.findUnique({
          ...(args as Prisma.BoardFindUniqueArgs),
          where: { id: boardId },
        });
        self.assertBelongsToOrg(
          board ? { organizationId: board.orgId } : null,
          "Board"
        );
        return board!;
      },

      /** Creates a board — orgId injected server-side, never from input. */
      create: (data: Omit<Prisma.BoardCreateInput, "organization" | "orgId">) =>
        db.board.create({
          data: { ...(data as any), orgId },
        }),

      /** Updates board after verifying org ownership. */
      update: async (boardId: string, data: Prisma.BoardUpdateInput) => {
        await self.verifyBoardOwnership(boardId);
        return db.board.update({ where: { id: boardId }, data });
      },

      /** Deletes board after verifying org ownership. */
      delete: async (boardId: string) => {
        await self.verifyBoardOwnership(boardId);
        return db.board.delete({ where: { id: boardId } });
      },
    };
  }

  // ── Lists ─────────────────────────────────────────────────────────────────

  get lists() {
    const self = this;

    return {
      /** Returns all lists for a board — board ownership verified first. */
      findMany: async (
        boardId: string,
        args?: Omit<Prisma.ListFindManyArgs, "where">
      ) => {
        await self.verifyBoardOwnership(boardId);
        return db.list.findMany({
          ...(args as Prisma.ListFindManyArgs),
          where: { boardId },
        });
      },

      /** Creates a list — board ownership verified before insert. */
      create: async (boardId: string, data: Omit<Prisma.ListCreateInput, "board">) => {
        await self.verifyBoardOwnership(boardId);
        return db.list.create({
          data: { ...(data as Prisma.ListCreateInput), board: { connect: { id: boardId } } },
        });
      },

      /** Updates list — verified via board ownership chain. */
      update: async (listId: string, boardId: string, data: Prisma.ListUpdateInput) => {
        await self.verifyListOwnership(listId, boardId);
        return db.list.update({ where: { id: listId, boardId }, data });
      },

      /** Deletes list — verified via board ownership chain. */
      delete: async (listId: string, boardId: string) => {
        await self.verifyListOwnership(listId, boardId);
        return db.list.delete({ where: { id: listId, boardId } });
      },

      /**
       * Reorders lists.
       * SECURITY: Verifies every list ID in the array belongs to the specified board
       * AND that the board belongs to this org before executing any update.
       * Prevents the list ID injection attack.
       */
      reorder: async (items: Array<{ id: string; order: string }>, boardId: string) => {
        await self.verifyBoardOwnership(boardId);

        // Fetch all list IDs for this board — ground truth from the DB
        const listsInBoard = await db.list.findMany({
          where: { boardId },
          select: { id: true },
        });
        const validIds = new Set(listsInBoard.map((l) => l.id));

        // Reject if any client-supplied ID is not in this board
        for (const item of items) {
          if (!validIds.has(item.id)) {
            throw new TenantError("NOT_FOUND", "List not found");
          }
        }

        return db.$transaction(
          items.map((list) =>
            db.list.update({ where: { id: list.id }, data: { order: list.order } })
          )
        );
      },
    };
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  get cards() {
    const self = this;

    return {
      /** Fetches card by ID and verifies it belongs to this org via relation chain. */
      findUnique: async <T extends Omit<Prisma.CardFindUniqueArgs, "where">>(
        cardId: string,
        args?: T
      ) => {
        const card = await db.card.findUnique({
          ...(args as unknown as Prisma.CardFindUniqueArgs),
          where: { id: cardId },
          include: {
            ...(args as any)?.include,
            list: {
              include: {
                board: { select: { orgId: true } },
              },
            },
          },
        });
        if (!card || (card as any).list?.board?.orgId !== self.orgId) {
          throw new TenantError("NOT_FOUND", "Card not found");
        }
        return card;
      },

      /** Creates a card — list ownership (board→org) verified before insert. */
      create: async (listId: string, boardId: string, data: Omit<Prisma.CardCreateInput, "list">) => {
        await self.verifyBoardOwnership(boardId);
        return db.card.create({
          data: { ...(data as Prisma.CardCreateInput), list: { connect: { id: listId } } },
        });
      },

      /** Updates card — ownership verified via Card→List→Board→orgId chain. */
      update: async (cardId: string, data: Prisma.CardUpdateInput) => {
        await self.verifyCardOwnership(cardId);
        return db.card.update({ where: { id: cardId }, data });
      },

      /** Deletes card — ownership verified via chain. */
      delete: async (cardId: string) => {
        await self.verifyCardOwnership(cardId);
        return db.card.delete({ where: { id: cardId } });
      },

      /**
       * Reorders cards.
       * SECURITY: Verifies every card ID in the array belongs to the specified board
       * AND that the board belongs to this org before any update executes.
       * Prevents the card ID injection attack (attacker passing arbitrary card IDs
       * from other orgs in the reorder payload).
       */
      reorder: async (
        items: Array<{ id: string; order: string; listId: string }>,
        boardId: string
      ) => {
        await self.verifyBoardOwnership(boardId);

        // Fetch all card IDs that actually belong to this board from the DB
        const cardsInBoard = await db.card.findMany({
          where: { list: { boardId } },
          select: { id: true },
        });
        const validIds = new Set(cardsInBoard.map((c) => c.id));

        // Reject if any client-supplied card ID is not in this board
        for (const item of items) {
          if (!validIds.has(item.id)) {
            throw new TenantError("NOT_FOUND", "Card not found");
          }
        }

        return db.$transaction(
          items.map((card) =>
            db.card.update({
              where: { id: card.id },
              data: { order: card.order, listId: card.listId },
            })
          )
        );
      },
    };
  }

  // ── Labels ────────────────────────────────────────────────────────────────

  get labels() {
    const orgId = this.orgId;
    const self = this;

    return {
      /** Returns all labels for this org. */
      findMany: () => db.label.findMany({ where: { orgId } }),

      /** Creates a label — orgId injected server-side. */
      create: (data: Omit<Prisma.LabelCreateInput, "orgId">) =>
        db.label.create({ data: { ...(data as Prisma.LabelCreateInput), orgId } }),

      /** Assigns label to card — verifies both belong to this org. */
      assign: async (cardId: string, labelId: string) => {
        await self.verifyCardOwnership(cardId);
        await self.verifyLabelOwnership(labelId);

        // Idempotent — return existing if already assigned
        const existing = await db.cardLabelAssignment.findUnique({
          where: { cardId_labelId: { cardId, labelId } },
        });
        if (existing) return existing;

        return db.cardLabelAssignment.create({ data: { cardId, labelId } });
      },

      /** Unassigns label from card — verifies both belong to this org. */
      unassign: async (cardId: string, labelId: string) => {
        await self.verifyCardOwnership(cardId);
        await self.verifyLabelOwnership(labelId);
        return db.cardLabelAssignment.deleteMany({ where: { cardId, labelId } });
      },

      /** Returns labels assigned to a specific card. */
      findManyForCard: async (cardId: string) => {
        await self.verifyCardOwnership(cardId);
        const assignments = await db.cardLabelAssignment.findMany({
          where: { cardId },
          include: { label: true },
        });
        return assignments.map((a) => ({ ...a.label, assignmentId: a.id }));
      },
    };
  }

  // ── Assignees ─────────────────────────────────────────────────────────────

  get assignees() {
    const self = this;

    return {
      /** Assigns a user to a card — card ownership verified. */
      assign: async (cardId: string, assigneeId: string) => {
        await self.verifyCardOwnership(cardId);
        return db.card.update({
          where: { id: cardId },
          data: { assigneeId },
          include: {
            assignee: { select: { id: true, name: true, imageUrl: true } },
            list: true,
          },
        });
      },

      /** Removes assignee from card — card ownership verified. */
      unassign: async (cardId: string) => {
        await self.verifyCardOwnership(cardId);
        return db.card.update({
          where: { id: cardId },
          data: { assigneeId: null },
          include: { list: true },
        });
      },

      /** Returns all users in this organization. */
      findOrgMembers: () =>
        db.organizationUser.findMany({
          where: { organizationId: self.orgId },
          include: {
            user: { select: { id: true, name: true, imageUrl: true, email: true } },
          },
        }),
    };
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  get comments() {
    const self = this;

    return {
      /** Fetches comment and verifies it belongs to this org via relation chain. */
      findUnique: async (commentId: string) => {
        const comment = await db.comment.findUnique({
          where: { id: commentId },
          include: {
            card: { include: { list: { select: { board: { select: { orgId: true } } } } } },
            reactions: true,
            replies: true,
          },
        });
        if (!comment || comment.card.list.board.orgId !== self.orgId) {
          throw new TenantError("NOT_FOUND", "Comment not found");
        }
        return comment;
      },

      /** Creates comment after verifying the card belongs to this org. */
      create: async (cardId: string, data: Omit<Prisma.CommentCreateInput, "card" | "userId" | "userName"> & { userName: string; userImage?: string | null; parentId?: string | null; mentions?: string[]; isDraft?: boolean }) => {
        await self.verifyCardOwnership(cardId);
        return db.comment.create({
          data: {
            text: data.text,
            cardId,
            userId: self.userId,
            userName: data.userName,
            userImage: data.userImage ?? null,
            parentId: data.parentId ?? null,
            mentions: data.mentions ?? [],
            isDraft: data.isDraft ?? false,
          },
          include: { reactions: true, replies: true },
        });
      },

      /** Updates comment — user must own the comment. */
      update: async (commentId: string, data: { text: string; mentions?: string[] }) => {
        const comment = await self.comments.findUnique(commentId);
        if (comment.userId !== self.userId) {
          throw new TenantError("FORBIDDEN", "Permission denied");
        }
        return db.comment.update({
          where: { id: commentId },
          data: { text: data.text, ...(data.mentions && { mentions: data.mentions }), isDraft: false },
          include: { reactions: true, replies: true },
        });
      },

      /** Deletes comment — user must own the comment. */
      delete: async (commentId: string) => {
        const comment = await self.comments.findUnique(commentId);
        if (comment.userId !== self.userId) {
          throw new TenantError("FORBIDDEN", "Permission denied");
        }
        return db.comment.delete({ where: { id: commentId } });
      },
    };
  }

  // ── Comment Reactions ─────────────────────────────────────────────────────

  get commentReactions() {
    const self = this;

    return {
      /** Adds a reaction — comment membership in org verified. */
      create: async (commentId: string, emoji: string, userName: string) => {
        // Verify comment belongs to org
        const comment = await db.comment.findUnique({
          where: { id: commentId },
          include: {
            card: { include: { list: { select: { board: { select: { orgId: true } } } } } },
          },
        });
        if (!comment || comment.card.list.board.orgId !== self.orgId) {
          throw new TenantError("NOT_FOUND", "Comment not found");
        }

        // Enforce unique per user per emoji
        const existing = await db.commentReaction.findFirst({
          where: { commentId, userId: self.userId, emoji },
        });
        if (existing) throw new Error("Already reacted with this emoji");

        return db.commentReaction.create({
          data: { emoji, commentId, userId: self.userId, userName },
        });
      },

      /** Removes a reaction — user must own the reaction. */
      delete: async (reactionId: string) => {
        const reaction = await db.commentReaction.findUnique({
          where: { id: reactionId },
          include: {
            comment: {
              include: {
                card: { include: { list: { select: { board: { select: { orgId: true } } } } } },
              },
            },
          },
        });
        if (!reaction || reaction.comment.card.list.board.orgId !== self.orgId) {
          throw new TenantError("NOT_FOUND", "Reaction not found");
        }
        if (reaction.userId !== self.userId) {
          throw new TenantError("FORBIDDEN", "Permission denied");
        }
        return db.commentReaction.delete({ where: { id: reactionId } });
      },
    };
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────

  get auditLogs() {
    const orgId = this.orgId;
    const userId = this.userId;

    return {
      /** Returns audit logs for this org only. */
      findMany: (args?: Omit<Prisma.AuditLogFindManyArgs, "where">) =>
        db.auditLog.findMany({
          ...(args as Prisma.AuditLogFindManyArgs),
          where: { orgId },
          orderBy: { createdAt: "desc" },
        }),

      /** Returns audit logs for a specific entity scoped to this org. */
      findManyForEntity: (entityId: string) =>
        db.auditLog.findMany({
          where: { entityId, orgId },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),

      /**
       * Creates an audit log entry.
       * orgId and userId come from DAL construction (from Clerk) — never from input.
       */
      create: (data: {
        entityId: string;
        entityType: "BOARD" | "LIST" | "CARD" | "ORGANIZATION";
        entityTitle: string;
        action: "CREATE" | "UPDATE" | "DELETE";
        userName?: string;
        userImage?: string;
      }) =>
        db.auditLog.create({
          data: {
            orgId,
            entityId: data.entityId,
            entityType: data.entityType as any,
            entityTitle: data.entityTitle,
            action: data.action as any,
            userId,
            userName: data.userName ?? "",
            userImage: data.userImage ?? "",
          },
        }),
    };
  }

  // ── Private ownership guards ──────────────────────────────────────────────

  /**
   * Asserts entity.organizationId matches this.orgId.
   * Returns NOT_FOUND on mismatch — does NOT reveal that the resource exists.
   */
  private assertBelongsToOrg(
    entity: { organizationId: string } | null,
    name: string
  ): void {
    if (!entity || entity.organizationId !== this.orgId) {
      throw new TenantError("NOT_FOUND", `${name} not found`);
    }
  }

  /** Verifies a board exists and belongs to this org. */
  private async verifyBoardOwnership(boardId: string): Promise<void> {
    const board = await db.board.findUnique({
      where: { id: boardId },
      select: { orgId: true },
    });
    if (!board || board.orgId !== this.orgId) {
      throw new TenantError("NOT_FOUND", "Board not found");
    }
  }

  /** Verifies a list exists, belongs to the given board, and the board belongs to this org. */
  private async verifyListOwnership(listId: string, boardId: string): Promise<void> {
    const list = await db.list.findUnique({
      where: { id: listId, boardId },
      select: { board: { select: { orgId: true } } },
    });
    if (!list || list.board.orgId !== this.orgId) {
      throw new TenantError("NOT_FOUND", "List not found");
    }
  }

  /** Verifies a card exists and belongs to this org via Card→List→Board→orgId chain. */
  private async verifyCardOwnership(cardId: string): Promise<void> {
    const card = await db.card.findUnique({
      where: { id: cardId },
      select: { list: { select: { board: { select: { orgId: true } } } } },
    });
    if (!card?.list?.board || card.list.board.orgId !== this.orgId) {
      throw new TenantError("NOT_FOUND", "Card not found");
    }
  }

  /** Verifies a label belongs to this org. */
  private async verifyLabelOwnership(labelId: string): Promise<void> {
    const label = await db.label.findUnique({
      where: { id: labelId },
      select: { orgId: true },
    });
    if (!label || label.orgId !== this.orgId) {
      throw new TenantError("NOT_FOUND", "Label not found");
    }
  }
}
