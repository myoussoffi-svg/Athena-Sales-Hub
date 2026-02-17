"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Play, Pause, CheckCircle } from "lucide-react";

interface CampaignStatusControlsProps {
  campaignId: string;
  currentStatus: string;
}

export function CampaignStatusControls({
  campaignId,
  currentStatus,
}: CampaignStatusControlsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
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
      console.error("Failed to update campaign status:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "ACTIVE" && (
        <Button
          variant="default"
          size="sm"
          onClick={() => updateStatus("ACTIVE")}
          disabled={loading}
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          Activate
        </Button>
      )}
      {currentStatus === "ACTIVE" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus("PAUSED")}
          disabled={loading}
        >
          <Pause className="h-3.5 w-3.5 mr-1.5" />
          Pause
        </Button>
      )}
      {currentStatus !== "COMPLETED" && currentStatus !== "DRAFT" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatus("COMPLETED")}
          disabled={loading}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
          Complete
        </Button>
      )}
    </div>
  );
}
