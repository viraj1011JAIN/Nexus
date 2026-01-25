"use server";

import { db } from "@/lib/db";
import { ENTITY_TYPE } from "@prisma/client";

export const getAuditLogs = async (cardId: string) => {
  try {
    const logs = await db.auditLog.findMany({
      where: {
        entityId: cardId,
        entityType: ENTITY_TYPE.CARD,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 3, // Only show the last 3 actions
    });

    return logs;
  } catch {
    return [];
  }
};