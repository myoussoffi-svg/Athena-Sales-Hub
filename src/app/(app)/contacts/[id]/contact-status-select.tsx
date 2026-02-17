"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Ban } from "lucide-react";
import { toast } from "sonner";

const contactStatuses = [
  { value: "NEW", label: "New" },
  { value: "RESEARCHED", label: "Researched" },
  { value: "OUTREACH_STARTED", label: "Outreach Started" },
  { value: "REPLIED", label: "Replied" },
  { value: "MEETING_SCHEDULED", label: "Meeting Scheduled" },
  { value: "CONVERTED", label: "Converted" },
  { value: "NOT_INTERESTED", label: "Not Interested" },
  { value: "BOUNCED", label: "Bounced" },
];

interface ContactStatusSelectProps {
  contactId: string;
  currentStatus: string;
}

export function ContactStatusSelect({
  contactId,
  currentStatus,
}: ContactStatusSelectProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }

      router.refresh();
    } catch (err) {
      console.error("Failed to update contact status:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkBounced() {
    if (!confirm("Mark this contact as bounced? This will cancel all pending outreach.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_bounced" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to mark as bounced");
      }

      const data = await res.json();
      toast.success(
        `Marked as bounced. ${data.cancelledOutreaches} outreach${data.cancelledOutreaches !== 1 ? "es" : ""} cancelled.`,
      );
      router.refresh();
    } catch (err) {
      console.error("Failed to mark contact as bounced:", err);
      toast.error("Failed to mark as bounced");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "BOUNCED" && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleMarkBounced}
          disabled={loading}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <Ban className="h-3.5 w-3.5" />
          Mark Bounced
        </Button>
      )}
      <Select
        value={currentStatus}
        onValueChange={handleChange}
        disabled={loading}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {contactStatuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
