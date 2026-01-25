import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { createBoard } from "@/actions/create-board";

export default async function Home() {
  // 1. Fetch data directly from the DB
  const boards = await db.board.findMany({
    orderBy: {
      createdAt: "desc", // Show the most recently created boards at the top
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-100 p-10">
      <h1 className="text-3xl font-bold text-slate-800">
        Nexus Boards ({boards.length})
      </h1>

      {/* 2. Create Board Form */}
      <form 
        action={async (formData) => {
          "use server";
          const title = formData.get("title") as string;
          const result = await createBoard({ title });
          if (result.error) {
            console.error("Failed to create board:", result.error);
          }
        }} 
        className="flex gap-2"
      >
        <input 
          name="title" 
          placeholder="Enter Board Name..." 
          className="border p-2 rounded-md outline-none focus:ring-2 ring-sky-500 transition"
          required
          // FIX: Prevents hydration errors caused by browser extensions/auto-fill
          suppressHydrationWarning 
        />
        <Button type="submit">Create Board</Button>
      </form>

      {/* 3. List of Boards */}
      <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
        {boards.map((board) => (
          <Link 
            key={board.id} 
            href={`/board/${board.id}`} 
            className="group relative p-4 bg-white shadow-sm rounded-lg border font-medium hover:bg-sky-50 hover:border-sky-200 transition-all flex items-center justify-between"
          >
            <span className="truncate pr-4">{board.title}</span>
            <span className="text-slate-400 group-hover:text-sky-600 transition-colors">→</span>
          </Link>
        ))}
        
        {boards.length === 0 && (
          <p className="text-slate-500 text-sm text-center italic">
            No boards yet. Create one above!
          </p>
        )}
      </div>
    </div>
  );
}