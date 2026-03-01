"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Users, Loader2, CheckCircle, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type BoardInfo = {
  id: string;
  title: string;
  isPrivate: boolean;
  memberCount: number;
  hasPendingRequest: boolean;
};

type MyRequest = {
  id: string;
  boardId: string | null;
  boardTitle: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

/**
 * Board Access Request Page
 *
 * Shows boards the user doesn't have access to, with option to request
 * access. Also shows the user's existing requests and their status.
 *
 * This page is accessible to any ACTIVE org member. Board contents
 * are never exposed — only titles and member counts.
 */
export default function RequestBoardAccessPage() {
  const [boards, setBoards] = useState<BoardInfo[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  // toast imported from sonner at top level

  useEffect(() => {
    // Fetch data on mount via API routes
    async function loadData() {
      try {
        const [boardsRes, requestsRes] = await Promise.all([
          fetch("/api/boards/requestable"),
          fetch("/api/membership-requests/mine"),
        ]);

        if (boardsRes.ok) {
          const data = await boardsRes.json();
          setBoards(data.boards ?? []);
        }
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          setMyRequests(data.requests ?? []);
        }
      } catch {
        toast.error("Failed to load board information.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []); // Load data on mount

  function handleRequestAccess(boardId: string) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/membership-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Request failed");
        }

        // Update local state
        setBoards((prev) =>
          prev.map((b) =>
            b.id === boardId ? { ...b, hasPendingRequest: true } : b
          )
        );

        toast.success("Request sent! A board admin will review your access request.");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to request access."
        );
      }
    });
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">
            Request Board Access
          </h1>
          <p className="text-slate-600 mt-2">
            Browse available boards and request access from board admins.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {/* Available Boards */}
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Available Boards
              </h2>
              {boards.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white/70 p-6 text-center text-slate-500">
                  You already have access to all boards in this organisation.
                </div>
              ) : (
                <div className="space-y-3">
                  {boards.map((board) => (
                    <div
                      key={board.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        {board.isPrivate ? (
                          <Lock className="h-5 w-5 text-slate-400" />
                        ) : (
                          <Users className="h-5 w-5 text-slate-400" />
                        )}
                        <div>
                          <p className="font-medium text-slate-900">
                            {board.title}
                          </p>
                          <p className="text-sm text-slate-500">
                            {board.memberCount}{" "}
                            {board.memberCount === 1 ? "member" : "members"}
                            {board.isPrivate && " · Private"}
                          </p>
                        </div>
                      </div>
                      <div>
                        {board.hasPendingRequest ? (
                          <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-medium px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                            <Clock className="h-3.5 w-3.5" />
                            Pending
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleRequestAccess(board.id)}
                            className="bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Request Access"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Requests */}
            {myRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-800 mb-4">
                  My Requests
                </h2>
                <div className="space-y-3">
                  {myRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm p-4 shadow-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {req.boardTitle ?? "Organisation Access"}
                        </p>
                        <p className="text-sm text-slate-500">
                          Requested{" "}
                          {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusIcon(req.status)}
                        <span
                          className={`text-sm font-medium ${
                            req.status === "PENDING"
                              ? "text-amber-600"
                              : req.status === "APPROVED"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
