"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Pause,
  Play,
  RefreshCw,
  CheckCircle,
  Trash2,
} from "lucide-react";

interface DomainActionsProps {
  domainId: string;
  warmupStatus: string;
}

export function DomainActions({ domainId, warmupStatus }: DomainActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleAction(action: string) {
    setLoading(action);
    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("Domain action failed:", data.error);
      }

      router.refresh();
    } catch (err) {
      console.error("Domain action error:", err);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this domain?")) return;

    setLoading("delete");
    try {
      const res = await fetch(`/api/domains/${domainId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete domain");
        return;
      }

      router.refresh();
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      {warmupStatus === "NEW" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("check_dns")}
            disabled={loading !== null}
          >
            {loading === "check_dns" ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Check DNS
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleAction("start_warmup")}
            disabled={loading !== null}
          >
            {loading === "start_warmup" ? (
              <Flame className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
            ) : (
              <Flame className="h-3.5 w-3.5 mr-1.5" />
            )}
            Start Warmup
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
            className="ml-auto text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {warmupStatus === "WARMING" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAction("pause_warmup")}
          disabled={loading !== null}
        >
          {loading === "pause_warmup" ? (
            <Pause className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
          ) : (
            <Pause className="h-3.5 w-3.5 mr-1.5" />
          )}
          Pause Warmup
        </Button>
      )}

      {warmupStatus === "READY" && (
        <Badge
          variant="secondary"
          className="bg-green-500/15 text-green-700 dark:text-green-400"
        >
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      )}

      {warmupStatus === "PAUSED" && (
        <>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleAction("start_warmup")}
            disabled={loading !== null}
          >
            {loading === "start_warmup" ? (
              <Play className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
            ) : (
              <Play className="h-3.5 w-3.5 mr-1.5" />
            )}
            Resume Warmup
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={loading !== null}
            className="ml-auto text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {warmupStatus === "FLAGGED" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("pause_warmup")}
            disabled={loading !== null}
          >
            {loading === "pause_warmup" ? (
              <Pause className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
            ) : (
              <Pause className="h-3.5 w-3.5 mr-1.5" />
            )}
            Pause
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction("check_dns")}
            disabled={loading !== null}
          >
            {loading === "check_dns" ? (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Check DNS
          </Button>
        </>
      )}
    </div>
  );
}
