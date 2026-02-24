"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles, LayoutDashboard, CheckCircle2, ArrowRight,
  Kanban, Users, Zap, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createBoard } from "@/actions/create-board";

// ─── Step Definition ──────────────────────────────────────────────────────────

type Step = "welcome" | "create-board" | "tips" | "done";

const STEPS: Step[] = ["welcome", "create-board", "tips", "done"];

const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome",
  "create-board": "First Board",
  tips: "Quick Tour",
  done: "Done",
};

// ─── Slide animations ─────────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -60, opacity: 0 }),
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

function StepProgress({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = (idx / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              "transition-colors font-medium",
              i <= idx ? "text-indigo-600 dark:text-indigo-400" : ""
            )}
          >
            {STEP_LABELS[s]}
          </span>
        ))}
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

// ─── Step panels ─────────────────────────────────────────────────────────────

function WelcomeStep({ userName, onNext }: { userName: string; onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Welcome to NEXUS{userName ? `, ${userName}` : ""}!
        </h2>
        <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
          Let&apos;s get your workspace set up in 3 quick steps. This takes less than a minute.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-sm mt-2">
        {[
          { icon: Kanban, label: "Create a board" },
          { icon: Users, label: "Invite your team" },
          { icon: Zap, label: "Start shipping" },
        ].map(({ icon: Icon, label }, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40"
          >
            <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Icon className="h-4 w-4 text-indigo-500" />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      <Button onClick={onNext} size="lg" className="gap-2 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 shadow-md">
        Get Started <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CreateBoardStep({
  onNext,
  onCreated,
}: {
  onNext: (boardId: string) => void;
  onCreated: (boardId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (title.trim().length < 3) {
      toast.error("Board name must be at least 3 characters.");
      return;
    }
    setLoading(true);
    try {
      const result = await createBoard({ title: title.trim() });
      if (result?.error) {
        if (result.error === "LIMIT_REACHED") {
          toast.error("Board limit reached. Upgrade to Pro for more boards.");
        } else {
          toast.error(result.error);
        }
        return;
      }
      if (result?.data) {
        onCreated(result.data.id);
        onNext(result.data.id);
      }
    } catch {
      toast.error("Failed to create board. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
          <LayoutDashboard className="h-6 w-6 text-indigo-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Create your first board</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A board organises your work into lists and cards.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1.5">
            Board name
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Product Roadmap, Sprint Q1, Marketing…"
            maxLength={50}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
            className="text-base"
            autoFocus
          />
          <p className="text-xs text-muted-foreground mt-1">{title.length}/50 characters</p>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={loading || title.trim().length < 3} className="gap-2 w-full">
        {loading ? "Creating…" : "Create Board"}
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TipsStep({ onNext }: { onNext: () => void }) {
  const tips = [
    {
      icon: "📋",
      title: "Add Lists",
      body: 'Click "+ Add a list" to create columns like "To Do", "In Progress", "Done".',
    },
    {
      icon: "🃏",
      title: "Create Cards",
      body: "Add a card to a list for every task. Set priority, due dates, and assign members.",
    },
    {
      icon: "⌨️",
      title: "Keyboard Shortcuts",
      body: 'Press "?" anywhere on the board to see all available keyboard shortcuts.',
    },
    {
      icon: "👥",
      title: "Invite Your Team",
      body: 'Go to Settings → Members to invite teammates. Free plan includes 5 members.',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <div className="h-12 w-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3">
          <Zap className="h-6 w-6 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">You&apos;re almost ready!</h2>
        <p className="mt-1 text-sm text-muted-foreground">A few tips to get the most out of NEXUS.</p>
      </div>

      <div className="space-y-3">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/30"
          >
            <span className="text-xl flex-shrink-0">{tip.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tip.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tip.body}</p>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={onNext} className="gap-2 w-full">
        Let&apos;s Go! <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function DoneStep({ boardId }: { boardId: string | null }) {
  const router = useRouter();

  const handleGoToBoard = () => {
    if (boardId) {
      router.push(`/board/${boardId}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="flex flex-col items-center text-center gap-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center"
      >
        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
      </motion.div>

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">All set! 🎉</h2>
        <p className="mt-2 text-muted-foreground max-w-sm mx-auto">
          Your workspace is ready. Head to your board and start adding tasks.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button onClick={handleGoToBoard} className="flex-1 gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0">
          {boardId ? "Open My Board" : "Go to Dashboard"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        You can always come back to these settings under{" "}
        <span className="text-indigo-500">Settings → Onboarding</span>.
      </p>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function OnboardingClient({ userName }: { userName: string }) {
  const [step, setStep] = useState<Step>("welcome");
  const [direction, setDirection] = useState(1);
  const [createdBoardId, setCreatedBoardId] = useState<string | null>(null);

  const advance = (nextStep: Step) => {
    setDirection(1);
    setStep(nextStep);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Progress */}
          <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <StepProgress current={step} />
          </div>

          {/* Step content with slide animation */}
          <div className="px-6 py-8 min-h-[380px] flex items-start">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="w-full"
              >
                {step === "welcome" && (
                  <WelcomeStep userName={userName} onNext={() => advance("create-board")} />
                )}
                {step === "create-board" && (
                  <CreateBoardStep
                    onCreated={(id) => setCreatedBoardId(id)}
                    onNext={() => advance("tips")}
                  />
                )}
                {step === "tips" && (
                  <TipsStep onNext={() => advance("done")} />
                )}
                {step === "done" && (
                  <DoneStep boardId={createdBoardId} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Skip link — only shown before done */}
        {step !== "done" && (
          <p className="text-center mt-4 text-xs text-muted-foreground">
            <button
              onClick={() => { setDirection(1); setStep("done"); }}
              className="hover:text-foreground underline transition-colors"
            >
              Skip setup and go to dashboard
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
