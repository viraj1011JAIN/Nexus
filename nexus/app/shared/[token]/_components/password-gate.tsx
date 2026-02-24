"use client";

/**
 * TASK-030 — Password Gate for Password-Protected Shared Boards
 *
 * Shown when a board share requires a password. The client component
 * calls getSharedBoardData with the entered password and, on success,
 * renders the SharedBoardView inline.
 */

import { useState, useTransition } from "react";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSharedBoardData } from "@/actions/board-share-actions";
import { SharedBoardView } from "@/components/board/shared-board-view";

interface PasswordGateProps {
  token: string;
  boardTitle?: string;
}

export function PasswordGate({ token, boardTitle }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [unlockedData, setUnlockedData] = useState<null | { board: any; share: any }>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await getSharedBoardData(token, password);
      if (result.error) {
        // The shared board page only renders PasswordGate when the token is valid and
        // password-protected, so any error here means the password was wrong.
        // Both wrong-password and invalid-token share the INVALID_TOKEN code — in this
        // context, treat any error as an incorrect password since the token was already
        // validated server-side before the gate was rendered.
        const isPasswordError = result.code === "INVALID_TOKEN" && password.length > 0;
        if (process.env.NODE_ENV !== "production") {
          console.error("[PasswordGate] access error code:", result.code);
        }
        setError(
          isPasswordError
            ? "Incorrect password. Please try again."
            : "Unable to access board. Please try again or contact support."
        );
        return;
      }
      if (result.data) {
        setUnlockedData(result.data);
        return;
      }
      // Neither error nor data — treat as unexpected failure
      setError("Unable to load board. Please try again.");
    });
  };

  // Once unlocked, render the board view
  if (unlockedData) {
    return <SharedBoardView board={unlockedData.board} share={unlockedData.share} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950 px-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border p-8 space-y-6">
          {/* Icon */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Lock className="h-7 w-7 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Password Required</h1>
              {boardTitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium">{boardTitle}</span> is protected.
                </p>
              )}
              {!boardTitle && (
                <p className="text-sm text-muted-foreground mt-1">
                  This board is password-protected.
                </p>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <label htmlFor="password-input" className="sr-only">Board password</label>
              <Input
                id="password-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter board password"
                autoFocus
                autoComplete="current-password"
                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                disabled={isPending}
                aria-describedby={error ? "password-error" : undefined}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {error && (
              <p id="password-error" className="text-sm text-destructive" role="alert" aria-live="polite">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isPending || !password.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Unlocking…
                </>
              ) : (
                "Unlock Board"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            You must have the board password to view this shared board.
          </p>
        </div>
      </div>
    </div>
  );
}
