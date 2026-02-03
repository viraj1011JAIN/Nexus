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
      take: 10, // Show the last 10 actions
    });

    return logs;
  } catch {
    return [];
  }
};