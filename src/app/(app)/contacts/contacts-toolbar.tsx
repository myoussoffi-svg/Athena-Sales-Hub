"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
}

interface ContactsToolbarProps {
  campaigns: Campaign[];
  currentSearch?: string;
  currentCampaignId?: string;
  currentStatus?: string;
}

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

export function ContactsToolbar({
  campaigns,
  currentSearch,
  currentCampaignId,
  currentStatus,
}: ContactsToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/contacts?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.push("/contacts");
  }, [router]);

  const hasFilters = currentSearch || currentCampaignId || currentStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, email, or organization..."
          defaultValue={currentSearch || ""}
          className="pl-9"
          onChange={(e) => {
            // Debounce search
            const value = e.target.value;
            const timeout = setTimeout(() => {
              updateParams("search", value || null);
            }, 300);
            return () => clearTimeout(timeout);
          }}
        />
      </div>

      <Select
        value={currentCampaignId || "all"}
        onValueChange={(value) => updateParams("campaignId", value)}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All campaigns" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All campaigns</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentStatus || "all"}
        onValueChange={(value) => updateParams("status", value)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {contactStatuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
