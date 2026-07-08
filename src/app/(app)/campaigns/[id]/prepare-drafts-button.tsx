"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface PrepareDraftsButtonProps {
  campaignId: string;
}

/**
 * One-click drafting pipeline: research all un-researched contacts in the
 * campaign, then generate personalized drafts for anyone without outreach.
 * Drafts land in the review queue (status DRAFT_CREATED) for approval.
 */
export function PrepareDraftsButton({ campaignId }: PrepareDraftsButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function prepare() {
    setLoading(true);
    const toastId = toast.loading("Researching contacts…");

    try {
      // 1. Bulk research
      const researchRes = await fetch(
        `/api/campaigns/${campaignId}/research-contacts`,
        { method: "POST" },
      );
      if (!researchRes.ok) {
        const data = await researchRes.json().catch(() => ({}));
        throw new Error(data.error || "Research step failed");
      }
      const research = (await researchRes.json()) as {
        researched: number;
        skippedNoUrl: number;
      };

      // 2. Generate drafts
      toast.loading("Writing drafts in your voice…", { id: toastId });
      const genRes = await fetch(`/api/outreach/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const gen = (await genRes.json().catch(() => ({}))) as {
        count?: number;
        total?: number;
        error?: string;
        errors?: string[];
      };

      if (!genRes.ok) {
        // 400 with count:0 means nothing eligible — treat as informational
        if (gen.error && (gen.count ?? 0) === 0) {
          toast.info(gen.error, { id: toastId });
          router.refresh();
          return;
        }
        throw new Error(gen.error || "Draft generation failed");
      }

      const parts: string[] = [];
      if (research.researched > 0)
        parts.push(`researched ${research.researched}`);
      parts.push(`drafted ${gen.count ?? 0}`);
      const summary = parts.join(", ");
      const extra =
        research.skippedNoUrl > 0
          ? ` (${research.skippedNoUrl} skipped — no website)`
          : "";

      toast.success(`Done: ${summary}.${extra}`, {
        id: toastId,
        description: "Drafts are in the review queue.",
        action: {
          label: "Review",
          onClick: () => router.push(`/outreach?campaignId=${campaignId}`),
        },
      });

      if (gen.errors && gen.errors.length > 0) {
        toast.warning(
          `${gen.errors.length} draft(s) had errors and were skipped.`,
        );
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong", {
        id: toastId,
      });
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
