"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PenLine, Loader2 } from "lucide-react";

export function DraftBuyerButton({ sponsor }: { sponsor: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function draft() {
    setLoading(true);
    const toastId = toast.loading(
      `Finding a contact and drafting outreach to ${sponsor}…`,
    );
    try {
      const res = await fetch("/api/buyer/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sponsor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Draft failed");
      toast.success("Draft ready — add the recipient and send.", {
        id: toastId,
      });
      router.push(`/outreach/${data.outreachId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Draft failed", {
        id: toastId,
      });
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={draft} disabled={loading}>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
      ) : (
        <PenLine className="h-3.5 w-3.5 mr-1.5" />
      )}
      Draft
    </Button>
  );
}
