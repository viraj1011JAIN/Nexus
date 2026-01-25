"use server";

import { db } from "@/lib/db";

export async function getCard(id: string) {
  try {
    const card = await db.card.findUnique({
      where: { id },
      include: {
        list: true, // We might want to know which list it's in
      },
    });
    return card;
  } catch (error) {
    return null;
  }
}