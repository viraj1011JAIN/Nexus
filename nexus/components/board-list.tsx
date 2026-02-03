"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, isValid, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { createBoard } from "@/actions/create-board";
import { deleteBoard } from "@/actions/delete-board";
import Link from "next/link";
import { Board } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const boardGradients = [
  "from-purple-500 to-indigo-600",
  "from-pink-500 to-rose-600",
  "from-blue-500 to-cyan-600",
  "from-green-500 to-emerald-600",
  "from-orange-500 to-amber-600",
  "from-red-500 to-pink-600",
  "from-teal-500 to-green-600",
  "from-violet-500 to-purple-600",
];

// Helper function to format dates safely
function formatRelativeDate(date: string | Date | null | undefined): string {
  if (!date) return "Never updated";
  
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      console.error("Invalid date:", date);
      return "Recently updated";
    }
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Recently updated";
  }
}

export function BoardList() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBoards();

    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      const channel = supabase
        .channel('boards-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'boards',
          },
          (payload) => {
            console.log('✅ Real-time board change detected:', payload);
            fetchBoards();
          }
        )
        .subscribe((status) => {
          console.log('🔌 Supabase subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  const fetchBoards = async () => {
    try {
      const res = await fetch('/api/boards');
      if (res.ok) {
        const data = await res.json();
        setBoards(data);
      }
    } finally {
      setLoading(false);
    }
  };

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
        fetchBoards();
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
        fetchBoards();
      }
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFBFC]">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-[#475569] text-base"
        >
          Loading boards...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFC] p-8">
      {/* Background Texture */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(135deg, #F0F4FF 0%, #FDF2F8 50%, #FEF3F2 100%)",
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 px-4 sm:px-6 lg:px-0">
        {/* Hero Section - Enhanced Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8 sm:mb-12 space-y-2 sm:space-y-3"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Nexus Boards
          </h1>
          <p className="text-[13px] text-[#64748B]">
            {boards.length} {boards.length === 1 ? "Board" : "Boards"}
          </p>
        </motion.div>

        {/* Create Board Section */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          onSubmit={handleCreateBoard}
          className="mb-8 sm:mb-12"
        >
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl bg-white rounded-xl p-3 sm:p-2 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)] transition-all duration-200">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter board name..."
              className="flex-1 px-4 sm:px-6 py-3 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none bg-transparent"
              disabled={isPending}
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={isPending}
              size="default"
              className="w-full sm:w-auto"
            >
              {isPending ? (
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="h-5 w-5 mr-2" />
                  Create Board
                </>
              )}
            </Button>
          </div>
        </motion.form>

        {/* Boards Grid */}
        {boards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="flex flex-col items-center justify-center py-24 px-8 bg-white rounded-2xl border border-[#E5E7EB]"
          >
            <div className="w-32 h-32 mb-6 rounded-full bg-gradient-to-br from-[#7C3AED]/10 to-[#EC4899]/10 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7C3AED]/20 to-[#EC4899]/20 flex items-center justify-center">
                <Plus className="h-8 w-8 text-[#7C3AED]" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-[#0F172A] mb-2">
              Your workspace is empty
            </h2>
            <p className="text-[15px] text-[#64748B] mb-6 text-center max-w-md">
              Create your first board to get started organizing your projects
            </p>
            <Button
              onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Enter board name..."]')?.focus()}
              size="default"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Your First Board
            </Button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <AnimatePresence>
              {boards.map((board, index) => (
                <motion.div
                  key={board.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="group"
                >
                  <Link href={`/board/${board.id}`}>
                    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-md hover:shadow-xl hover:border-purple-300 transition-all duration-200 overflow-hidden h-80 flex flex-col cursor-pointer">
                      {/* Colored Header Area */}
                      <div
                        className={`h-32 bg-gradient-to-br ${
                          boardGradients[index % boardGradients.length]
                        } p-5 flex items-start justify-between`}
                      >
                        <h3 className="text-xl font-semibold text-white truncate pr-2">
                          {board.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (confirm(`Delete board "${board.title}"?`)) {
                              handleDeleteBoard(board.id, board.title);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm transition-all duration-200 hover:scale-105"
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4 text-white" />
                        </button>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-5 flex flex-col justify-between bg-white">
                        {/* List Preview */}
                        <div className="flex gap-2 mb-4">
                          <div className="w-2 h-12 bg-[#E5E7EB] rounded-full" />
                          <div className="w-2 h-12 bg-[#E5E7EB] rounded-full" />
                          <div className="w-2 h-12 bg-[#E5E7EB] rounded-full" />
                        </div>

                        {/* Metadata */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
                            <div className="w-5 h-5 rounded-full bg-[#F3F4F6] flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-[#7C3AED]" />
                            </div>
                            <span>0 cards</span>
                          </div>
                          <div className="flex items-center gap-2 text-[13px] text-[#64748B]">
                            <Clock className="h-4 w-4" />
                            <span>
                              {formatRelativeDate(board.updatedAt)}
                            </span>
                          </div>
                          {/* Collaborator Avatars Placeholder */}
                          <div className="flex items-center gap-1">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#A855F7] border-2 border-white shadow-sm" />
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#EC4899] to-[#BE185D] border-2 border-white shadow-sm -ml-2" />
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#2563EB] border-2 border-white shadow-sm -ml-2" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
