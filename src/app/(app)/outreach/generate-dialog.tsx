"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  type: string;
}

export function GenerateDialog({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [emailMode, setEmailMode] = useState<"template" | "ai">("template");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{
    count: number;
    total: number;
    errors?: string[];
  } | null>(null);

  const handleGenerate = async () => {
    if (!selectedCampaignId) {
      toast.error("Please select a campaign");
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          useTemplate: emailMode === "template",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Generation failed");
        setIsGenerating(false);
        return;
      }

      setResult(data);
      toast.success(`Generated ${data.count} email${data.count !== 1 ? "s" : ""}`);
      router.refresh();
    } catch {
      toast.error("Failed to generate emails. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    if (!isGenerating) {
      setOpen(false);
      setResult(null);
      setSelectedCampaignId("");
      setEmailMode("template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button>
          <Sparkles className="h-4 w-4" />
          Generate for Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Outreach Emails</DialogTitle>
          <DialogDescription>
            AI will generate personalized emails for all uncontacted contacts in
            the selected campaign.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Campaign</label>
                <Select
                  value={selectedCampaignId}
                  onValueChange={setSelectedCampaignId}
                  disabled={isGenerating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an active campaign..." />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No active campaigns
                      </SelectItem>
                    ) : (
                      campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          <div className="flex items-center gap-2">
                            <span>{campaign.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatType(campaign.type)})
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Email mode selector */}
              {selectedCampaignId && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEmailMode("template")}
                        disabled={isGenerating}
                        className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          emailMode === "template"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span className="font-medium block">Standard Template</span>
                        <span className="text-xs text-muted-foreground">
                          Same email for all contacts
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailMode("ai")}
                        disabled={isGenerating}
                        className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                          emailMode === "ai"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span className="font-medium block">AI Personalized</span>
                        <span className="text-xs text-muted-foreground">
                          Unique email per contact
                        </span>
                      </button>
                    </div>
                  </div>
                )}

              {isGenerating && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      Generating personalized emails... This may take a minute.
                    </span>
                  </div>
                  <Progress value={undefined} className="animate-pulse" />
                  <p className="text-xs text-muted-foreground">
                    Each email is individually crafted by AI with
                    personalization based on contact research data.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!selectedCampaignId || isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate Emails
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">
                    {result.count} of {result.total} emails generated
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ready for your review
                  </p>
                </div>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                    {result.errors.length} error
                    {result.errors.length !== 1 ? "s" : ""}:
                  </p>
                  <ul className="text-xs text-red-600 dark:text-red-400/80 space-y-0.5">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>...and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button asChild>
                <Link
                  href={`/outreach?campaignId=${selectedCampaignId}`}
                  onClick={() => setOpen(false)}
                >
                  Review Emails
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
