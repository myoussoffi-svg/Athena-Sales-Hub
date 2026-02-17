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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Target } from "lucide-react";

interface RegenerateDialogProps {
  outreachId: string;
  hookUsed: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegenerateDialog({
  outreachId,
  hookUsed,
  open,
  onOpenChange,
}: RegenerateDialogProps) {
  const router = useRouter();
  const [customInstructions, setCustomInstructions] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    setIsRegenerating(true);

    try {
      const res = await fetch(`/api/outreach/${outreachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "regenerate",
          customInstructions: customInstructions.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Regeneration failed");
      }

      toast.success("Email regenerated with a fresh take");
      onOpenChange(false);
      setCustomInstructions("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to regenerate email",
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Regenerate Email
          </DialogTitle>
          <DialogDescription>
            AI will generate a completely new email. Optionally provide custom
            direction for a different angle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current hook display */}
          {hookUsed && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/50 px-3 py-2.5">
              <Target className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                  Current personalization hook
                </p>
                <p className="text-sm">{hookUsed}</p>
              </div>
            </div>
          )}

          {/* Custom instructions */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Custom Direction{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Textarea
              placeholder='Try a different angle, e.g., "Focus more on their recent expansion to Austin" or "Use a more direct tone and mention our healthcare specialization"'
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              disabled={isRegenerating}
              className="min-h-[100px]"
            />
            <div className="flex flex-wrap gap-1.5">
              <SuggestionChip
                label="Different hook"
                onClick={() =>
                  setCustomInstructions(
                    "Use a completely different personalization angle",
                  )
                }
                disabled={isRegenerating}
              />
              <SuggestionChip
                label="More casual"
                onClick={() =>
                  setCustomInstructions(
                    "Make the tone more casual and conversational",
                  )
                }
                disabled={isRegenerating}
              />
              <SuggestionChip
                label="More direct"
                onClick={() =>
                  setCustomInstructions(
                    "Be more direct and concise, get to the point faster",
                  )
                }
                disabled={isRegenerating}
              />
              <SuggestionChip
                label="Shorter"
                onClick={() =>
                  setCustomInstructions(
                    "Make it significantly shorter, 2-3 sentences max",
                  )
                }
                disabled={isRegenerating}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionChip({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-accent transition-colors text-xs font-normal"
      onClick={() => !disabled && onClick()}
    >
      {label}
    </Badge>
  );
}
