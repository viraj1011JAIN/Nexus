import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { createBoard } from "@/actions/create-board";
import { deleteBoard } from "@/actions/delete-board";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

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
          if (!title || title.trim().length === 0) {
            console.error("Title is required");
            return;
          }
          const result = await createBoard({ title: title.trim() });
          if (result.error) {
            console.error("Failed to create board:", result.error);
          } else {
            console.log("Board created successfully:", result.data);
            redirect("/");
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
          <div
            key={board.id}
            className="group relative p-4 bg-white shadow-sm rounded-lg border hover:border-sky-200 transition-all flex items-center justify-between"
          >
            <Link 
              href={`/board/${board.id}`}
              className="flex-1 font-medium hover:text-sky-600 transition-colors truncate pr-4"
            >
              {board.title}
            </Link>
            
            <form
              action={async () => {
                "use server";
                const result = await deleteBoard({ id: board.id });
                if (result.error) {
                  console.error("Failed to delete board:", result.error);
                } else {
                  redirect("/");
                }
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          </div>
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