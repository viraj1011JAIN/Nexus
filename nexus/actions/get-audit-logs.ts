"use server";
import "server-only";

import { createDAL } from "@/lib/dal";
import { TenantError } from "@/lib/tenant-context";

export const getAuditLogs = async (cardId: string) => {
  try {
    const dal = await createDAL();
    // DAL verifies the cardId belongs to this org before returning audit logs
    return await dal.auditLogs.findManyForEntity(cardId);
  } catch (error) {
    if (error instanceof TenantError) return [];
    return [];
  }
};