"use server";
import "server-only";

import { createDAL } from "@/lib/dal";
import { getTenantContext, requireRole, TenantError } from "@/lib/tenant-context";

export const getAuditLogs = async (cardId: string) => {
  try {
    // Require at least MEMBER role — audit logs should not be accessible to GUESTs
    const ctx = await getTenantContext();
    await requireRole("MEMBER", ctx);

    const dal = await createDAL(ctx);
    // DAL verifies the cardId belongs to this org before returning audit logs
    return await dal.auditLogs.findManyForEntity(cardId);
  } catch (error) {
    if (error instanceof TenantError) return [];
    return [];
  }
};