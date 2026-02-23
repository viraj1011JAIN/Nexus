"use server";

import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export interface AttachmentDto {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedByName: string;
  createdAt: Date;
}

/** Returns all attachments for a card. */
export async function getCardAttachments(
  cardId: string
): Promise<{ data?: AttachmentDto[]; error?: string }> {
  await getTenantContext(); // auth check

  const attachments = await db.attachment.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
  });

  return {
    data: attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      fileSize: a.fileSize,
      mimeType: a.mimeType,
      url: a.url,
      uploadedByName: a.uploadedByName,
      createdAt: a.createdAt,
    })),
  };
}

/** Deletes an attachment record (storage deletion is handled in the API route). */
export async function deleteAttachment(
  attachmentId: string,
  boardId: string
): Promise<{ error?: string }> {
  const ctx = await getTenantContext();

  const attachment = await db.attachment.findFirst({
    where: { id: attachmentId },
    include: { card: { include: { list: { include: { board: true } } } } },
  });

  if (!attachment) return { error: "Attachment not found" };

  // Verify the attachment belongs to this org
  if (attachment.card.list.board.orgId !== ctx.orgId) {
    return { error: "Forbidden" };
  }

  await db.attachment.delete({ where: { id: attachmentId } });
  revalidatePath(`/board/${boardId}`);
  return {};
}
