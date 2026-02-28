"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext, requireRole } from "@/lib/tenant-context";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction, ActionState } from "@/lib/create-safe-action";
import { TenantError } from "@/lib/tenant-context";
import { clearPermissionCache } from "@/lib/board-permissions";
import type { PermissionScheme, PermissionSchemeEntry, BoardRole, BoardPermission } from "@prisma/client";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreatePermissionSchemeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional().default(false),
  entries: z.array(z.object({
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
    permission: z.string(), // BoardPermission enum value
    granted: z.boolean(),
  })).optional().default([]),
});

const UpdatePermissionSchemeSchema = z.object({
  schemeId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  entries: z.array(z.object({
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
    permission: z.string(),
    granted: z.boolean(),
  })).optional(),
});

const DeletePermissionSchemeSchema = z.object({
  schemeId: z.string().uuid(),
});

const AssignSchemeToBoardSchema = z.object({
  boardId: z.string().uuid(),
  schemeId: z.string().uuid().nullable(), // null = remove scheme (use defaults)
});

const GetPermissionSchemesSchema = z.object({});

// ─── Types ────────────────────────────────────────────────────────────────────

type SchemeWithEntries = PermissionScheme & { entries: PermissionSchemeEntry[] };

type CreateInput = z.infer<typeof CreatePermissionSchemeSchema>;
type CreateReturn = ActionState<CreateInput, SchemeWithEntries>;

type UpdateInput = z.infer<typeof UpdatePermissionSchemeSchema>;
type UpdateReturn = ActionState<UpdateInput, SchemeWithEntries>;

type DeleteInput = z.infer<typeof DeletePermissionSchemeSchema>;
type DeleteReturn = ActionState<DeleteInput, { success: true }>;

type AssignInput = z.infer<typeof AssignSchemeToBoardSchema>;
type AssignReturn = ActionState<AssignInput, { success: true }>;

type GetInput = z.infer<typeof GetPermissionSchemesSchema>;
type GetReturn = ActionState<GetInput, SchemeWithEntries[]>;

// ─── Create Permission Scheme ─────────────────────────────────────────────────

const createPermissionSchemeHandler = async (data: CreateInput): Promise<CreateReturn> => {
  const ctx = await getTenantContext();
  // Only org ADMIN/OWNER can create permission schemes
  await requireRole("ADMIN", ctx);

  // Check for duplicate name within org
  const existing = await db.permissionScheme.findFirst({
    where: { orgId: ctx.orgId, name: data.name },
  });

  if (existing) {
    return { error: "A permission scheme with this name already exists." };
  }

  try {
    // If setting as default, unset any existing default
    if (data.isDefault) {
      await db.permissionScheme.updateMany({
        where: { orgId: ctx.orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const scheme = await db.permissionScheme.create({
      data: {
        orgId: ctx.orgId,
        name: data.name,
        description: data.description ?? null,
        isDefault: data.isDefault || false,
        entries: {
          create: data.entries.map((e) => ({
            role: e.role as BoardRole,
            permission: e.permission as BoardPermission,
            granted: e.granted,
          })),
        },
      },
      include: { entries: true },
    });

    await createAuditLog({
      entityId: scheme.id,
      entityType: "PERMISSION_SCHEME",
      entityTitle: scheme.name,
      action: "PERMISSION_SCHEME_CREATED",
      orgId: ctx.orgId,
    });

    return { data: scheme };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create permission scheme.";
    return { error: message };
  }
};

export const createPermissionScheme = createSafeAction(CreatePermissionSchemeSchema, createPermissionSchemeHandler);

// ─── Update Permission Scheme ─────────────────────────────────────────────────

const updatePermissionSchemeHandler = async (data: UpdateInput): Promise<UpdateReturn> => {
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx);

  // Verify scheme belongs to this org
  const scheme = await db.permissionScheme.findUnique({
    where: { id: data.schemeId },
    select: { id: true, orgId: true, name: true },
  });

  if (!scheme || scheme.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Permission scheme not found");
  }

  // Check for name collision if name is being changed
  if (data.name && data.name !== scheme.name) {
    const duplicate = await db.permissionScheme.findFirst({
      where: { orgId: ctx.orgId, name: data.name, id: { not: data.schemeId } },
    });
    if (duplicate) {
      return { error: "A permission scheme with this name already exists." };
    }
  }

  try {
    // If setting as default, unset any existing default
    if (data.isDefault) {
      await db.permissionScheme.updateMany({
        where: { orgId: ctx.orgId, isDefault: true, id: { not: data.schemeId } },
        data: { isDefault: false },
      });
    }

    // If entries are provided, replace all entries
    if (data.entries !== undefined) {
      // Delete existing entries
      await db.permissionSchemeEntry.deleteMany({
        where: { schemeId: data.schemeId },
      });

      // Create new entries
      if (data.entries.length > 0) {
        await db.permissionSchemeEntry.createMany({
          data: data.entries.map((e) => ({
            schemeId: data.schemeId,
            role: e.role as BoardRole,
            permission: e.permission as BoardPermission,
            granted: e.granted,
          })),
        });
      }
    }

    const updated = await db.permissionScheme.update({
      where: { id: data.schemeId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
      include: { entries: true },
    });

    clearPermissionCache();

    await createAuditLog({
      entityId: updated.id,
      entityType: "PERMISSION_SCHEME",
      entityTitle: updated.name,
      action: "PERMISSION_SCHEME_UPDATED",
      orgId: ctx.orgId,
    });

    return { data: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update permission scheme.";
    return { error: message };
  }
};

export const updatePermissionScheme = createSafeAction(UpdatePermissionSchemeSchema, updatePermissionSchemeHandler);

// ─── Delete Permission Scheme ─────────────────────────────────────────────────

const deletePermissionSchemeHandler = async (data: DeleteInput): Promise<DeleteReturn> => {
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx);

  const scheme = await db.permissionScheme.findUnique({
    where: { id: data.schemeId },
    select: { id: true, orgId: true, name: true },
  });

  if (!scheme || scheme.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Permission scheme not found");
  }

  // Check if any boards are using this scheme
  const boardsUsingScheme = await db.board.count({
    where: { permissionSchemeId: data.schemeId },
  });

  if (boardsUsingScheme > 0) {
    return { error: `This scheme is currently used by ${boardsUsingScheme} board(s). Remove the scheme from all boards first.` };
  }

  // Check if any members are using this scheme as override
  const membersUsingScheme = await db.boardMember.count({
    where: { permissionSchemeId: data.schemeId },
  });

  if (membersUsingScheme > 0) {
    return { error: `This scheme is used as an override by ${membersUsingScheme} board member(s). Remove the overrides first.` };
  }

  await db.permissionScheme.delete({ where: { id: data.schemeId } });
  clearPermissionCache();

  await createAuditLog({
    entityId: scheme.id,
    entityType: "PERMISSION_SCHEME",
    entityTitle: scheme.name,
    action: "PERMISSION_SCHEME_DELETED",
    orgId: ctx.orgId,
  });

  return { data: { success: true } };
};

export const deletePermissionScheme = createSafeAction(DeletePermissionSchemeSchema, deletePermissionSchemeHandler);

// ─── Assign Scheme to Board ──────────────────────────────────────────────────

const assignSchemeToBoardHandler = async (data: AssignInput): Promise<AssignReturn> => {
  const ctx = await getTenantContext();
  await requireRole("ADMIN", ctx);

  // Verify board belongs to org
  const board = await db.board.findUnique({
    where: { id: data.boardId },
    select: { id: true, orgId: true, title: true, permissionSchemeId: true },
  });

  if (!board || board.orgId !== ctx.orgId) {
    throw new TenantError("NOT_FOUND", "Board not found");
  }

  // If assigning a scheme, verify it belongs to this org
  if (data.schemeId) {
    const scheme = await db.permissionScheme.findUnique({
      where: { id: data.schemeId },
      select: { id: true, orgId: true },
    });

    if (!scheme || scheme.orgId !== ctx.orgId) {
      throw new TenantError("NOT_FOUND", "Permission scheme not found");
    }
  }

  await db.board.update({
    where: { id: data.boardId },
    data: { permissionSchemeId: data.schemeId },
  });

  clearPermissionCache();

  await createAuditLog({
    entityId: board.id,
    entityType: "BOARD",
    entityTitle: board.title,
    action: "UPDATE",
    orgId: ctx.orgId,
    boardId: data.boardId,
    previousValues: { permissionSchemeId: board.permissionSchemeId },
    newValues: { permissionSchemeId: data.schemeId },
  });

  revalidatePath(`/board/${data.boardId}`);
  return { data: { success: true } };
};

export const assignSchemeToBoard = createSafeAction(AssignSchemeToBoardSchema, assignSchemeToBoardHandler);

// ─── Get Permission Schemes ──────────────────────────────────────────────────

const getPermissionSchemesHandler = async (_data: GetInput): Promise<GetReturn> => {
  const ctx = await getTenantContext();
  await requireRole("MEMBER", ctx);

  const schemes = await db.permissionScheme.findMany({
    where: { orgId: ctx.orgId },
    include: { entries: true },
    orderBy: { name: "asc" },
  });

  return { data: schemes };
};

export const getPermissionSchemes = createSafeAction(GetPermissionSchemesSchema, getPermissionSchemesHandler);
