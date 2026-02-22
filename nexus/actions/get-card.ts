"use server";

import { createDAL } from "@/lib/dal";
import { TenantError } from "@/lib/tenant-context";

export async function getCard(id: string) {
  try {
    const dal = await createDAL();
    const card = await dal.cards.findUnique(id, {
      include: {
        list: true,
        assignee: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });
    return card;
  } catch (error) {
    if (error instanceof TenantError) return null; // card not in this org — return null, not an error
    return null;
  }
}