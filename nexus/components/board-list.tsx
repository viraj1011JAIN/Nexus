"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createBoard } from "@/actions/create-board";
import { deleteBoard } from "@/actions/delete-board";
import Link from "next/link";
import { Board } from "@prisma/client";

interface BoardListProps {
  boards: Board[];
}

export function BoardList({ boards: initialBoards }: BoardListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || title.trim().length === 0) {
      toast.error("Board title is required");
      return;
    }

    startTransition(async () => {
      const result = await createBoard({ title: title.trim() });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Board "${result.data?.title}" created successfully!`);
        setTitle("");
        router.refresh();
      }
    });
  };

  const handleDeleteBoard = async (id: string, boardTitle: string) => {
    startTransition(async () => {
      const result = await deleteBoard({ id });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Board "${boardTitle}" deleted`);
        router.refresh();
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-10 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-gradient">
            Nexus Boards
          </h1>
          <p className="text-slate-600 font-medium">{initialBoards.length} {initialBoards.length === 1 ? 'Board' : 'Boards'}</p>
        </div>

        {/* Create Board Form */}
        <form onSubmit={handleCreateBoard} className="flex gap-3 w-full max-w-md">
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter board name..." 
            className="flex-1 glass-effect px-4 py-3 rounded-xl outline-none focus:ring-2 ring-indigo-400 focus:ring-offset-2 transition-all placeholder:text-slate-400 text-slate-700 font-medium shadow-sm hover:shadow-md"
            disabled={isPending}
            autoComplete="off"
            suppressHydrationWarning
          />
          <Button 
            type="submit" 
            disabled={isPending}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 px-6"
          >
            {isPending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Board
            </>
          )}
        </Button>
      </form>

        {/* List of Boards */}
        <div className="flex flex-col gap-4 w-full max-w-md">
          {initialBoards.map((board, index) => (
            <div
              key={board.id}
              style={{ animationDelay: `${index * 0.1}s` }}
              className="group relative p-5 glass-effect rounded-2xl border border-white/20 hover:shadow-2xl hover:shadow-indigo-200/50 transition-all duration-300 flex items-center justify-between hover:scale-102 animate-fadeInUp overflow-hidden"
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <Link 
                href={`/board/${board.id}`}
                className="relative flex-1 font-semibold text-slate-800 hover:text-transparent hover:bg-gradient-to-r hover:from-indigo-600 hover:to-purple-600 hover:bg-clip-text transition-all truncate pr-4 z-10"
              >
                {board.title}
              </Link>
            
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 opacity-0 group-hover:opacity-100 transition-all duration-300 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:scale-110 active:scale-95 rounded-xl z-10"
                onClick={() => handleDeleteBoard(board.id, board.title)}
                disabled={isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        
          {initialBoards.length === 0 && (
            <div className="glass-effect p-8 rounded-2xl text-center space-y-3 animate-scaleIn">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center">
                <Plus className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="text-slate-600 font-medium">
                No boards yet. Create your first board above!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
