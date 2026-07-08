"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface PrepareDraftsButtonProps {
  campaignId: string;
}

const CHUNK = 5;

/**
 * One-click drafting pipeline. Processes the campaign in small resumable chunks
 * (research + draft) so 100+ contacts never hit the serverless timeout. Shows
 * running progress and stops on completion or a stall (rows that keep failing).
 */
export function PrepareDraftsButton({ campaignId }: PrepareDraftsButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    const toastId = toast.loading("Preparing drafts…");

    let totalDrafted = 0;
    let stall = 0;
    let guard = 0;
    const GUARD_MAX = 500; // hard cap on chunk calls, way above any real run

    try {
      while (guard++ < GUARD_MAX) {
        const res = await fetch(
          `/api/campaigns/${campaignId}/prepare-batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ limit: CHUNK }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Chunk failed (${res.status})`);
        }

        const { processed, drafted, remaining } = (await res.json()) as {
          processed: number;
          drafted: number;
          remaining: number;
        };

        totalDrafted += drafted;

        // Nothing left to do
        if (processed === 0 || remaining === 0) {
          toast.success(`Prepared ${totalDrafted} draft(s).`, {
            id: toastId,
            description: "They're in the review queue.",
            action: {
              label: "Review",
              onClick: () =>
                router.push(`/outreach?campaignId=${campaignId}`),
            },
          });
          break;
        }

        // Stall guard: a chunk ran but drafted nothing and didn't shrink the
        // backlog — the leading rows keep failing. Stop and report.
        if (drafted === 0) {
          stall++;
          if (stall >= 2) {
            toast.warning(
              `Prepared ${totalDrafted}. ${remaining} could not be prepared (skipped).`,
              { id: toastId },
            );
            break;
          }
        } else {
          stall = 0;
        }

        toast.loading(`Preparing… ${totalDrafted} done, ${remaining} left`, {
          id: toastId,
        });
      }
      router.refresh();
    } catch (err) {
      toast.error(
        `${err instanceof Error ? err.message : "Something went wrong"}. Prepared ${totalDrafted} so far — click Prepare Drafts again to resume.`,
        { id: toastId },
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={prepare} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Sparkles className="h-4 w-4 mr-2" />
      )}
      {loading ? "Preparing…" : "Prepare Drafts"}
    </Button>
  );
}
