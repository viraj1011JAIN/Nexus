"use server";

import { db } from "@/lib/db";

export async function getCard(id: string) {
  try {
    const card = await db.card.findUnique({
      where: { id },
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
    return null;
  }
}