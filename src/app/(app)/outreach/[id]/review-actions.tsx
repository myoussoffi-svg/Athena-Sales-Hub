"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Pencil,
  RefreshCw,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { RegenerateDialog } from "./regenerate-dialog";

interface ReviewActionsProps {
  outreachId: string;
  hookUsed: string;
  prevId: string | null;
  nextId: string | null;
  currentIndex: number;
  totalCount: number;
}

export function ReviewActions({
  outreachId,
  hookUsed,
  prevId,
  nextId,
  currentIndex,
  totalCount,
}: ReviewActionsProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

  const navigateToNext = useCallback(() => {
    if (nextId) {
      router.push(`/outreach/${nextId}`);
    } else {
      router.push("/outreach");
      toast.success("All done! No more emails to review.");
    }
  }, [nextId, router]);

  const handleApprove = useCallback(async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/outreach/${outreachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve");
      }

      toast.success("Email approved and queued for sending");
      navigateToNext();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve email",
      );
    } finally {
      setIsApproving(false);
    }
  }, [outreachId, navigateToNext]);

  const handleSkip = useCallback(async () => {
    setIsSkipping(true);
    try {
      const res = await fetch(`/api/outreach/${outreachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to skip");
      }

      toast("Email skipped", {
        description: "It won't be sent.",
      });
      navigateToNext();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to skip email",
      );
    } finally {
      setIsSkipping(false);
    }
  }, [outreachId, navigateToNext]);

  const handleEdit = useCallback(() => {
    // Toggle the email editor via the exposed global function
    const toggle = (window as unknown as Record<string, unknown>)
      .__emailEditorToggle;
    if (typeof toggle === "function") {
      (toggle as () => void)();
    }
  }, []);

  // ── Keyboard Shortcuts ──────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger shortcuts when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          handleApprove();
          break;
        case "e":
          e.preventDefault();
          handleEdit();
          break;
        case "r":
          e.preventDefault();
          setShowRegenerateDialog(true);
          break;
        case "s":
          e.preventDefault();
          handleSkip();
          break;
        case "arrowleft":
          e.preventDefault();
          if (prevId) router.push(`/outreach/${prevId}`);
          break;
        case "arrowright":
          e.preventDefault();
          if (nextId) router.push(`/outreach/${nextId}`);
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleApprove, handleEdit, handleSkip, prevId, nextId, router]);

  return (
    <>
      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between px-6 py-3 max-w-[1400px] mx-auto">
          {/* Left: Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!prevId}
              onClick={() => prevId && router.push(`/outreach/${prevId}`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!nextId}
              onClick={() => nextId && router.push(`/outreach/${nextId}`)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <span className="text-sm text-muted-foreground tabular-nums">
              Reviewing{" "}
              <span className="font-medium text-foreground">
                {currentIndex}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalCount}</span>
            </span>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            {/* Skip */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkip}
              disabled={isSkipping || isApproving}
              className="text-muted-foreground"
            >
              {isSkipping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SkipForward className="h-4 w-4" />
              )}
              Skip
              <kbd className="pointer-events-none ml-1 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:inline-flex">
                S
              </kbd>
            </Button>

            {/* Edit */}
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4" />
              Edit
              <kbd className="pointer-events-none ml-1 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:inline-flex">
                E
              </kbd>
            </Button>

            {/* Regenerate */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(true)}
              disabled={isApproving}
              className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
              <kbd className="pointer-events-none ml-1 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-70 sm:inline-flex">
                R
              </kbd>
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            {/* Approve & Send */}
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving || isSkipping}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Approve & Send
              <kbd className="pointer-events-none ml-1 hidden h-5 select-none items-center gap-1 rounded border border-green-500/30 bg-green-500/20 px-1.5 font-mono text-[10px] font-medium opacity-80 sm:inline-flex">
                A
              </kbd>
            </Button>
          </div>
        </div>
      </div>

      {/* Regenerate dialog */}
      <RegenerateDialog
        outreachId={outreachId}
        hookUsed={hookUsed}
        open={showRegenerateDialog}
        onOpenChange={setShowRegenerateDialog}
      />
    </>
  );
}
