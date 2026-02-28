import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { captureSentryException } from "@/lib/sentry-helpers";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

interface Props {
  entityId: string;
  entityType: ENTITY_TYPE;
  entityTitle: string;
  action: ACTION;
  /** Skip redundant auth() call when orgId is already resolved by the caller */
  orgId?: string;
}

export const createAuditLog = async (props: Props) => {
  try {
    const { entityId, entityType, entityTitle, action } = props;
    const orgId = props.orgId ?? (await auth()).orgId;
    const user = await currentUser();
    
    if (!orgId || !user) {
      throw new Error("Unauthorized");
    }

    await db.auditLog.create({
      data: {
        orgId,
        entityId,
        entityType,
        entityTitle,
        action,
        userId: user.id,
        userImage: user.imageUrl,
        userName: `${user.firstName} ${user.lastName}`,
      },
    });
    
  } catch (error) {
    // Audit log failure is a compliance gap — log loudly and alert via Sentry.
    // We intentionally do NOT re-throw so the parent action can still succeed;
    // however, the failure is tracked for on-call investigation.
    logger.error("[AUDIT_LOG_ERROR] Failed to write audit log — compliance gap", { error, ...props });
    captureSentryException(error, { level: "error", tags: { source: "audit-log" } });
  }
};