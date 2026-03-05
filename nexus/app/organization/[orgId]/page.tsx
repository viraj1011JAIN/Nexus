"use client";

/**
 * /organization/[orgId] — Demo landing page (+ catch-all for stale deeplinks)
 *
 * Public route — no Clerk session required.
 *
 * Behaviour:
 *  • orgId === "demo-org-id"   → render the read-only demo dashboard below
 *  • any other orgId           → redirect authenticated users to /dashboard
 *                                (they landed here via a stale deeplink)
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, BarChart3, Settings, Bell, Search,
  Plus, ChevronRight, Clock, CheckCircle2, AlertCircle, Circle,
  Star, ArrowRight, Zap, Shield, Lock, Calendar, Tag, Paperclip,
  MessageSquare, MoreHorizontal,
} from "lucide-react";
import { DEMO_ORG_ID } from "@/hooks/use-demo-mode";
import DemoModeProvider from "@/components/demo/DemoModeProvider";

// ─── Sample demo data ────────────────────────────────────────────────────────

const DEMO_BOARDS = [
  { id: "b1", title: "Product Roadmap",    emoji: "🗺️",  color: "from-violet-600 to-indigo-600",  cards: 24, members: 6  },
  { id: "b2", title: "Sprint 47",          emoji: "⚡",  color: "from-pink-600 to-rose-600",      cards: 18, members: 4  },
  { id: "b3", title: "Marketing Q2",       emoji: "📣",  color: "from-cyan-600 to-blue-600",      cards: 31, members: 8  },
  { id: "b4", title: "Design System 2.0",  emoji: "🎨",  color: "from-amber-500 to-orange-600",   cards: 15, members: 3  },
  { id: "b5", title: "Customer Feedback",  emoji: "💬",  color: "from-emerald-600 to-teal-600",   cards: 42, members: 5  },
  { id: "b6", title: "Infrastructure",     emoji: "🔧",  color: "from-slate-600 to-zinc-600",     cards: 9,  members: 2  },
];

const DEMO_ACTIVITY = [
  { user: "Alex K.", action: "moved",    entity: "Deploy API v3",    board: "Sprint 47",      time: "2m ago",  avatar: "AK", color: "bg-violet-500"  },
  { user: "Priya S.", action: "created", entity: "New onboarding flow", board: "Product Roadmap", time: "14m ago", avatar: "PS", color: "bg-pink-500" },
  { user: "Tom W.",  action: "closed",   entity: "Fix dark mode bug", board: "Design System",  time: "1h ago",  avatar: "TW", color: "bg-cyan-500"   },
  { user: "Mei L.",  action: "assigned", entity: "Auth refactor",     board: "Sprint 47",      time: "2h ago",  avatar: "ML", color: "bg-amber-500"  },
  { user: "Dana B.", action: "added",    entity: "Figma export guide", board: "Design System", time: "3h ago",  avatar: "DB", color: "bg-emerald-500"},
];

const DEMO_CARDS = [
  { title: "Migrate auth to Clerk v6",    priority: "urgent", due: "Mar 5",  status: "in-progress", tags: ["backend", "auth"]            },
  { title: "Redesign onboarding flow",    priority: "high",   due: "Mar 8",  status: "in-review",   tags: ["design", "ux"]               },
  { title: "Add Stripe subscription sync",priority: "high",   due: "Mar 10", status: "todo",        tags: ["billing"]                    },
  { title: "Performance audit — LCP fix", priority: "medium", due: "Mar 12", status: "todo",        tags: ["perf"]                       },
  { title: "Write API documentation",     priority: "low",    due: "Mar 20", status: "todo",        tags: ["docs"]                       },
  { title: "Set up E2E test suite",        priority: "medium", due: "Mar 15", status: "in-progress", tags: ["testing"]                    },
];

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400 bg-red-500/10 border-red-500/20",
  high:   "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  low:    "text-green-400 bg-green-500/10 border-green-500/20",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  "todo":        <Circle      className="h-[14px] w-[14px] text-slate-500"  />,
  "in-progress": <Clock       className="h-[14px] w-[14px] text-amber-400"  />,
  "in-review":   <AlertCircle className="h-[14px] w-[14px] text-cyan-400"   />,
  "done":        <CheckCircle2 className="h-[14px] w-[14px] text-emerald-400" />,
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function OrganizationPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const router = useRouter();
  const [activeBoard, setActiveBoard] = useState("b1");
  const [activeTab, setActiveTab]     = useState<"boards" | "activity" | "tasks">("boards");

  // Non-demo org or missing session: send to dashboard / sign-in
  useEffect(() => {
    if (orgId !== DEMO_ORG_ID) {
      router.replace("/dashboard");
    } else {
      sessionStorage.setItem("demo-mode", "true");
      sessionStorage.setItem("demo-start-time", Date.now().toString());
    }
  }, [orgId, router]);

  if (orgId !== DEMO_ORG_ID) return null;

  return (
    <DemoModeProvider>
    <div className="min-h-screen bg-[#07070f] text-white font-sans overflow-hidden">

      {/* ── Demo banner ────────────────────────────────────────────────── */}
      <div className="w-full bg-gradient-to-r from-amber-600/90 to-orange-600/90 backdrop-blur-sm py-[10px] px-6 flex items-center justify-between text-sm z-50 relative">
        <div className="flex items-center gap-2">
          <span className="text-[18px]">🎯</span>
          <span className="font-semibold text-white">You&apos;re in Guest Demo Mode</span>
          <span className="text-white/80 hidden sm:inline">— read-only. Changes are not saved.</span>
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
          <button className="p-[8px] rounded-lg hover:bg-white/[0.06] text-white/50 transition-colors relative">
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
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
              }`}
            >
              <Icon className="h-[16px] w-[16px] shrink-0" />
              {label}
            </button>
          ))}

          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold px-3 mb-2">Recent Boards</p>
            {DEMO_BOARDS.slice(0, 4).map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBoard(b.id)}
                className={`flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[12px] w-full transition-colors ${
                  activeBoard === b.id
                    ? "text-white bg-white/[0.06]"
                    : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                <span className="text-[14px]">{b.emoji}</span>
                <span className="truncate">{b.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-6 py-6">

          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[22px] font-bold text-white">Demo Organisation</h1>
              <p className="text-[13px] text-white/50 mt-0.5">6 boards · 8 members · Guest access</p>
            </div>
            <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 transition-colors text-white text-[13px] font-semibold px-4 py-[9px] rounded-lg shadow-lg shadow-violet-500/25 opacity-50 cursor-not-allowed" disabled>
              <Plus className="h-[15px] w-[15px]" />
              New Board
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Open Issues",   value: "47",  sub: "+3 today",  accent: "text-violet-400"  },
              { label: "In Progress",   value: "12",  sub: "across 4 boards", accent: "text-amber-400" },
              { label: "Completed",     value: "138", sub: "this month", accent: "text-emerald-400" },
              { label: "Team Members",  value: "8",   sub: "2 online",   accent: "text-cyan-400"   },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-[14px] p-4">
                <p className="text-[12px] text-white/50 font-medium mb-1">{s.label}</p>
                <p className={`text-[28px] font-bold font-mono ${s.accent}`}>{s.value}</p>
                <p className="text-[11px] text-white/30 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 mb-5 bg-white/[0.03] border border-white/[0.06] rounded-[10px] p-1 w-fit">
            {(["boards", "activity", "tasks"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`capitalize text-[13px] font-semibold px-4 py-[7px] rounded-[8px] transition-all ${
                  activeTab === tab
                    ? "bg-violet-600 text-white shadow shadow-violet-500/30"
                    : "text-white/50 hover:text-white/70"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ── Boards grid ── */}
          {activeTab === "boards" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {DEMO_BOARDS.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setActiveBoard(b.id)}
                  className={`group relative rounded-[18px] overflow-hidden border cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl ${
                    activeBoard === b.id
                      ? "border-violet-500/40 shadow-lg shadow-violet-500/10"
                      : "border-white/[0.07] hover:border-white/[0.15]"
                  }`}
                >
                  <div className={`h-[90px] bg-gradient-to-br ${b.color} relative`}>
                    <div className="absolute inset-0 bg-black/20" />
                    <span className="absolute top-4 left-4 text-[28px]">{b.emoji}</span>
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 bg-black/30 rounded-lg backdrop-blur-sm">
                        <Star className="h-[13px] w-[13px] text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-[#0d0d1a] p-4">
                    <h3 className="font-semibold text-[14px] text-white mb-1">{b.title}</h3>
                    <div className="flex items-center justify-between text-[12px] text-white/40">
                      <span>{b.cards} cards</span>
                      <div className="flex -space-x-[6px]">
                        {Array.from({ length: Math.min(b.members, 4) }).map((_, i) => (
                          <div
                            key={i}
                            className="w-[22px] h-[22px] rounded-full border-2 border-[#0d0d1a] bg-gradient-to-br from-violet-500 to-pink-500"
                            style={{ opacity: 1 - i * 0.15, zIndex: 4 - i }}
                          />
                        ))}
                        {b.members > 4 && (
                          <div className="w-[22px] h-[22px] rounded-full border-2 border-[#0d0d1a] bg-white/10 flex items-center justify-center text-[9px] text-white/60">
                            +{b.members - 4}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add board CTA */}
              <div className="rounded-[18px] border border-dashed border-white/[0.1] flex items-center justify-center h-[160px] text-white/30 hover:text-white/50 hover:border-white/[0.2] transition-colors cursor-not-allowed">
                <div className="text-center">
                  <Plus className="h-[20px] w-[20px] mx-auto mb-2 opacity-50" />
                  <p className="text-[12px]">Create board</p>
                  <p className="text-[11px] text-white/20 mt-0.5">(sign up to enable)</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Activity feed ── */}
          {activeTab === "activity" && (
            <div className="space-y-2 max-w-[600px]">
              {DEMO_ACTIVITY.map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[14px]">
                  <div className={`w-[34px] h-[34px] rounded-full ${a.color} flex items-center justify-center text-[12px] font-bold text-white shrink-0`}>
                    {a.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/80">
                      <span className="font-semibold text-white">{a.user}</span>
                      {" "}{a.action}{" "}
                      <span className="text-violet-300 font-medium">&ldquo;{a.entity}&rdquo;</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-white/30">{a.board}</span>
                      <span className="text-white/20">·</span>
                      <span className="text-[11px] text-white/30">{a.time}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-[14px] w-[14px] text-white/20 shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}

          {/* ── Tasks list ── */}
          {activeTab === "tasks" && (
            <div className="space-y-2 max-w-[700px]">
              {DEMO_CARDS.map((c, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-[14px] hover:border-white/[0.1] transition-colors">
                  <div className="shrink-0">{STATUS_ICON[c.status]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{c.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {c.tags.map((t) => (
                        <span key={t} className="text-[10px] font-medium px-[6px] py-[2px] rounded bg-white/[0.06] text-white/50 border border-white/[0.07]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] font-semibold px-[8px] py-[3px] rounded border ${PRIORITY_COLOR[c.priority]} capitalize`}>
                      {c.priority}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] text-white/40">
                      <Calendar className="h-[11px] w-[11px]" />
                      {c.due}
                    </div>
                    <div className="flex items-center gap-2 text-white/30">
                      <div className="flex items-center gap-1 text-[11px]">
                        <MessageSquare className="h-[11px] w-[11px]" />
                        3
                      </div>
                      <div className="flex items-center gap-1 text-[11px]">
                        <Paperclip className="h-[11px] w-[11px]" />
                        2
                      </div>
                    </div>
                    <MoreHorizontal className="h-[15px] w-[15px] text-white/20" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── Right sidebar — feature highlights ───────────────────────── */}
        <aside className="hidden xl:flex flex-col w-[260px] shrink-0 bg-[#0a0a14] border-l border-white/[0.06] p-5 gap-5 overflow-y-auto">
          {/* Sign up CTA */}
          <div className="rounded-[16px] bg-gradient-to-br from-violet-600/20 to-indigo-600/10 border border-violet-500/20 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-[16px] w-[16px] text-violet-400" />
              <p className="text-[13px] font-bold text-white">Ready to start?</p>
            </div>
            <p className="text-[12px] text-white/60 leading-relaxed mb-4">
              Get your own workspace with all features unlocked — free forever for small teams.
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
            <p className="text-[10px] uppercase tracking-wider text-white/30 font-semibold mb-3">What you get</p>
            <div className="space-y-2.5">
              {[
                { icon: Shield,          label: "Enterprise-grade security"  },
                { icon: Zap,             label: "Real-time collaboration"     },
                { icon: BarChart3,       label: "Advanced analytics"          },
                { icon: Lock,            label: "Fine-grained permissions"    },
                { icon: Tag,             label: "Custom fields & labels"      },
                { icon: Users,           label: "Unlimited team members"      },
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
