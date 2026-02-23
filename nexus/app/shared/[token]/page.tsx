import { getSharedBoardData } from "@/actions/board-share-actions";
import { SharedBoardView } from "@/components/board/shared-board-view";
import { notFound } from "next/navigation";

interface SharedBoardPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedBoardPage({ params }: SharedBoardPageProps) {
  const { token } = await params;
  const result = await getSharedBoardData(token);

  if (result.error || !result.data) {
    notFound();
  }

  return (
    <SharedBoardView
      board={result.data.board}
      share={result.data.share}
    />
  );
}

export async function generateMetadata({ params }: SharedBoardPageProps) {
  const { token } = await params;
  const result = await getSharedBoardData(token);
  if (!result.data) return { title: "Shared Board" };
  return {
    title: `${result.data.board.title} — Shared Board`,
    description: `View the shared board: ${result.data.board.title}`,
  };
}
