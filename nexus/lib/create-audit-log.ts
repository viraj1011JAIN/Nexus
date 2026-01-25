import { db } from "@/lib/db";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

interface Props {
  entityId: string;
  entityType: ENTITY_TYPE;
  entityTitle: string;
  action: ACTION;
}

export const createAuditLog = async (props: Props) => {
  try {
    const { entityId, entityType, entityTitle, action } = props;

    // --- MOCK USER DATA (Replace this with Clerk later) ---
    const orgId = "default-organization"; // Hardcoded Org
    const user = {
        id: "test-user-123",
        firstName: "Test",
        lastName: "User",
        imageUrl: "https://github.com/shadcn.png" // Placeholder image
    };
    // ----------------------------------------------------

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
    console.log("[AUDIT_LOG_ERROR]", error);
  }
};