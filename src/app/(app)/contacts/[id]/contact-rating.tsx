"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StarRating } from "@/components/ui/star-rating";

export function ContactRating({ contactId, initialRating }: { contactId: string; initialRating: number | null }) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating);

  async function handleChange(newRating: number | null) {
    setRating(newRating);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.refresh();
    } catch {
      setRating(initialRating);
      toast.error("Failed to save rating");
    }
  }

  return <StarRating value={rating} onChange={handleChange} size="md" />;
}
