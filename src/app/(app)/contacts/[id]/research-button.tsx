"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";

interface ResearchButtonProps {
  contactId: string;
}

export function ResearchButton({ contactId }: ResearchButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleResearch() {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/research`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Research failed");
      }

      router.refresh();
    } catch (err) {
      console.error("Research failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleResearch}
      disabled={loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          Researching...
        </>
      ) : (
        <>
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Research
        </>
      )}
    </Button>
  );
}
