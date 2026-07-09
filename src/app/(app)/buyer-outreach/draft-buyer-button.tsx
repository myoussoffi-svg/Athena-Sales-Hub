"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PenLine, Loader2 } from "lucide-react";

export function DraftBuyerButton({ sponsor }: { sponsor: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");

  async function draft() {
    setLoading(true);
    const toastId = toast.loading(`Drafting outreach to ${sponsor}…`);
    try {
      const res = await fetch("/api/buyer/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsor,
          contactName: contactName.trim() || undefined,
          contactTitle: contactTitle.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Draft failed");
      toast.success("Draft ready — add the recipient and send.", {
        id: toastId,
      });
      setOpen(false);
      router.push(`/outreach/${data.outreachId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft failed", {
        id: toastId,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PenLine className="h-3.5 w-3.5 mr-1.5" />
          Draft
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Draft outreach to {sponsor}</DialogTitle>
          <DialogDescription>
            If you already know the contact from Apollo, add their name so
            the email greets them by name instead of &ldquo;Hi there,&rdquo;.
            Both fields are optional — leave blank if you haven&apos;t
            found the contact yet.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contactName" className="text-xs">
              Contact first name
            </Label>
            <Input
              id="contactName"
              placeholder="e.g. Naveen"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactTitle" className="text-xs">
              Title (optional)
            </Label>
            <Input
              id="contactTitle"
              placeholder="e.g. CEO, Qualus"
              value={contactTitle}
              onChange={(e) => setContactTitle(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={draft} disabled={loading} className="gap-1.5">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PenLine className="h-3.5 w-3.5" />
            )}
            Generate Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
