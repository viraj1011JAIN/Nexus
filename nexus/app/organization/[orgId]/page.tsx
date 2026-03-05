"use client";

/**
 * /organization/[orgId] — Interactive Demo Page
 *
 * Public route — no Clerk session required.
 *
 * Behaviour:
 *  - orgId === "demo-org-id"  → render interactive demo with limited features
 *  - any other orgId          → redirect to /dashboard
 *
 * Demo limits:
 *  - Max 2 boards (can create new ones)
 *  - Max 10 cards total (can create + DnD)
 *  - Everything is in-memory — no persistence
 */

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BarChart3, Settings, Bell, Search,
  Plus, ArrowRight, Zap, Shield, Lock, Calendar, Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DEMO_ORG_ID } from "@/hooks/use-demo-mode";
import { useDemoData, DEMO_MAX_BOARDS, DEMO_MAX_CARDS } from "@/hooks/use-demo-data";
import DemoModeProvider from "@/components/demo/DemoModeProvider";
import DemoKanbanBoard from "@/components/demo/DemoKanbanBoard";

export default function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();
  const { boards, cards, createBoard, deleteBoard, getTotalCardCount } = useDemoData();
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const boardInputRef = useRef<HTMLInputElement>(null);

  // Non-demo org → redirect
  useEffect(() => {
    if (orgId !== DEMO_ORG_ID) {
      router.replace("/dashboard");
    } else {
      sessionStorage.setItem("demo-mode", "true");
      sessionStorage.setItem("demo-start-time", Date.now().toString());
    }
  }, [orgId, router]);

  // Set first board as active when boards load
  useEffect(() => {
    if (!activeBoardId && boards.length > 0) {
      setActiveBoardId(boards[0].id);
    }
  }, [boards, activeBoardId]);

  if (orgId !== DEMO_ORG_ID) return null;

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const totalCards = getTotalCardCount();

  const handleCreateBoard = () => {
    const title = boardInputRef.current?.value.trim();
    if (!title) return;
    const result = createBoard(title);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Board "${title}" created!`);
    if (boardInputRef.current) boardInputRef.current.value = "";
    setIsCreatingBoard(false);
    // Switch to the new board
    const newBoard = useDemoData.getState().boards.at(-1);
    if (newBoard) setActiveBoardId(newBoard.id);
  };

  const handleDeleteBoard = (boardId: string) => {
    deleteBoard(boardId);
    toast.info("Board deleted");
    if (activeBoardId === boardId) {
      const remaining = boards.filter((b) => b.id !== boardId);
      setActiveBoardId(remaining[0]?.id ?? null);
    }
  };

  return (
    <DemoModeProvider>
    <div className="min-h-screen bg-[#07070f] text-white font-sans overflow-hidden">

      {/* ── Demo banner ────────────────────────────────────────────────── */}
      <div className="w-full bg-gradient-to-r from-amber-600/90 to-orange-600/90 backdrop-blur-sm py-[10px] px-6 flex items-center justify-between text-sm z-50 relative">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">{"\ud83c\udfaf"}</span>
          <span className="font-semibold text-white">Demo Mode</span>
          <span className="text-white/80 hidden sm:inline">— {boards.length}/{DEMO_MAX_BOARDS} boards · {totalCards}/{DEMO_MAX_CARDS} cards · drag &amp; drop enabled</span>
        </div>
        <Link
          href="/sign-up"
          className="flex items-center gap-1.5 bg-white text-orange-600 font-bold px-4 py-[6px] rounded-lg text-[13px] hover:bg-orange-50 transition-colors shrink-0 ml-4"
        >
          Sign up free <ArrowRight className="h-[13px] w-[13px]" />
        </Link>
      </div>

      {/* ── Top nav ────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 h-[58px] border-b border-white/[0.06] bg-[#0d0d1a]/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <span className="text-white font-bold text-[15px]">N</span>
          </div>
          <span className="text-white font-bold text-[18px] tracking-tight">NEXUS</span>
          <span className="text-white/30 text-[18px] font-light ml-1">/</span>
          <span className="text-white/70 text-[14px] font-medium">Demo Organisation</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-[7px] text-[13px] text-white/50 w-[200px]">
            <Search className="h-[13px] w-[13px]" />
            <span>Search…</span>
          </div>
          <button className="p-[8px] rounded-lg hover:bg-white/[0.06] text-white/50 transition-colors relative" aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute top-[6px] right-[6px] w-[6px] h-[6px] bg-violet-500 rounded-full" />
          </button>
          <div className="w-[32px] h-[32px] rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[12px] font-bold text-white ml-1">
            G
          </div>
        </div>
      </nav>

      <div className="flex h-[calc(100vh-58px-40px)] overflow-hidden">

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-[#0a0a14] border-r border-white/[0.06] p-4 gap-1 overflow-y-auto">
          {[
            { icon: LayoutDashboard, label: "Boards",   active: true  },
            { icon: BarChart3,       label: "Analytics", active: false },
            { icon: Users,           label: "Members",   active: false },
            { icon: Calendar,        label: "Timeline",  active: false },
            { icon: Settings,        label: "Settings",  active: false },
          ].map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13px] font-medium transition-colors text-left w-full ${
                active
                  ? "bg-violet-600/20 text-violet-300 border border-violet-500/20"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04] cursor-not-allowed opacity-50"
              }`}
              disabled={!active}
            >
              <Icon className="h-[16px] w-[16px] shrink-0" />
              {label}
              {!active && <Lock className="h-[10px] w-[10px] ml-auto text-white/20" />}
            </button>
          ))}

          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <div className="flex items-center justify-between px-3 mb-2">
              <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                Boards ({boards.length}/{DEMO_MAX_BOARDS})
              </p>
            </div>
            {boards.map((b) => (
              <div key={b.id} className="group flex items-center">
                <button
                  onClick={() => setActiveBoardId(b.id)}
                  className={`flex-1 flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12px] transition-colors ${
                    activeBoardId === b.id
                      ? "text-white bg-white/[0.06]"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="text-[14px]">{b.emoji}</span>
                  <span className="truncate">{b.title}</span>
                </button>
                <button
                  onClick={() => handleDeleteBoard(b.id)}
                  className="p-1 rounded text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all mr-1"
                  title={`Delete board ${b.title}`}
                  aria-label={`Delete board ${b.title}`}
                >
                  <X className="w-[12px] h-[12px]" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col">

          {/* Board header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
            <div>
              {activeBoard ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px]">{activeBoard.emoji}</span>
                    <h1 className="text-[20px] font-bold text-white">{activeBoard.title}</h1>
                  </div>
                  <p className="text-[12px] text-white/40 mt-0.5">
                    {cards.filter((c) => c.boardId === activeBoard.id).length} cards · Drag cards between lists
                  </p>
                </>
              ) : (
                <h1 className="text-[20px] font-bold text-white/50">No boards yet — create one!</h1>
              )}
            </div>

            {/* Create board button */}
            {!isCreatingBoard ? (
              <button
                onClick={() => {
                  if (boards.length >= DEMO_MAX_BOARDS) {
                    toast.error(`Demo limit: max ${DEMO_MAX_BOARDS} boards. Sign up for unlimited!`);
                    return;
                  }
                  setIsCreatingBoard(true);
                  setTimeout(() => boardInputRef.current?.focus(), 50);
                }}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors text-white text-[13px] font-semibold px-4 py-[9px] rounded-lg shadow-lg shadow-violet-500/25"
              >
                <Plus className="h-[15px] w-[15px]" />
                New Board
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  ref={boardInputRef}
                  type="text"
                  placeholder="Board name..."
                  maxLength={50}
                  className="bg-white/[0.06] border border-white/[0.12] text-white text-[13px] px-3 py-[8px] rounded-lg outline-none focus:border-violet-500/50 placeholder:text-white/30 w-[200px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateBoard();
                    if (e.key === "Escape") setIsCreatingBoard(false);
                  }}
                />
                <button
                  onClick={handleCreateBoard}
                  className="px-3 py-[8px] bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-lg transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setIsCreatingBoard(false)}
                  className="p-2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label="Cancel board creation"
                >
                  <X className="w-[16px] h-[16px]" />
                </button>
              </div>
            )}
          </div>

          {/* Kanban Board */}
          <div className="flex-1 overflow-auto">
            {activeBoard ? (
              <DemoKanbanBoard boardId={activeBoard.id} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-[56px] h-[56px] rounded-[16px] bg-violet-600/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-[24px] h-[24px] text-violet-400" />
                  </div>
                  <p className="text-[15px] text-white/60 font-medium mb-1">Create your first board</p>
                  <p className="text-[13px] text-white/30">Click &ldquo;New Board&rdquo; to get started</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Right sidebar — feature highlights ───────────────────────── */}
        <aside className="hidden xl:flex flex-col w-[260px] shrink-0 bg-[#0a0a14] border-l border-white/[0.06] p-5 gap-5 overflow-y-auto">
          {/* Limits info */}
          <div className="rounded-[14px] bg-white/[0.03] border border-white/[0.06] p-4">
            <p className="text-[11px] uppercase tracking-wider text-white/30 font-semibold mb-3">Demo Limits</p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/60">Boards</span>
                <span className="font-mono text-violet-400">{boards.length} / {DEMO_MAX_BOARDS}</span>
              </div>
              <div className="w-full h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(boards.length / DEMO_MAX_BOARDS) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-white/60">Cards</span>
                <span className="font-mono text-violet-400">{totalCards} / {DEMO_MAX_CARDS}</span>
              </div>
              <div className="w-full h-[4px] bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${(totalCards / DEMO_MAX_CARDS) * 100}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-white/30 mt-3 leading-relaxed">
              Sign up to remove all limits and unlock full features.
            </p>
          </div>

          {/* Sign up CTA */}
          <div className="rounded-[16px] bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-[16px] w-[16px] text-violet-400" />
              <p className="text-[13px] font-bold text-white">Ready to start?</p>
            </div>
            <p className="text-[12px] text-white/60 leading-relaxed mb-4">
              Get your own workspace with unlimited boards, cards, and all features unlocked.
            </p>
            <Link
              href="/sign-up"
              className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-500 transition-colors text-white text-[13px] font-semibold py-[10px] rounded-[10px] shadow-lg shadow-violet-500/20"
            >
              Create free account <ArrowRight className="h-[13px] w-[13px]" />
            </Link>
            <Link
              href="/sign-in"
              className="flex items-center justify-center w-full text-[12px] text-white/50 hover:text-white/80 transition-colors mt-3"
            >
              Already have an account?
            </Link>
          </div>

          {/* Feature list */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-3">Unlock with signup</p>
            <div className="space-y-2.5">
              {[
                { icon: Shield,    label: "Enterprise-grade security" },
                { icon: Zap,       label: "Real-time collaboration"   },
                { icon: BarChart3, label: "Advanced analytics"        },
                { icon: Lock,      label: "Fine-grained permissions"  },
                { icon: Tag,       label: "Custom fields & labels"    },
                { icon: Users,     label: "Unlimited team members"    },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5 text-[12px] text-white/60">
                  <Icon className="h-[13px] w-[13px] text-violet-400 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-auto bg-white/[0.03] border border-white/[0.06] rounded-[12px] p-4">
            <div className="flex -space-x-[8px] mb-3">
              {["from-violet-500 to-pink-500", "from-cyan-500 to-blue-500", "from-amber-500 to-orange-500", "from-emerald-500 to-teal-500"].map((g, i) => (
                <div key={i} className={`w-[28px] h-[28px] rounded-full border-2 border-[#0a0a14] bg-gradient-to-br ${g}`} style={{ zIndex: 4 - i }} />
              ))}
            </div>
            <p className="text-[11px] text-white/50">
              Trusted by <span className="text-white/80 font-semibold">2,000+</span> teams worldwide
            </p>
          </div>
        </aside>
      </div>
    </div>
    </DemoModeProvider>
  );
}
