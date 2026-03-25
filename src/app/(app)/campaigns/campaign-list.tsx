"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Mail, Search } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  createdAt: string;
  _count: { contacts: number; outreaches: number };
  createdBy: { name: string | null } | null;
}

const campaignStatusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400",
  PAUSED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

function formatCampaignType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const [search, setSearch] = useState("");

  const filtered = campaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="text-xs text-muted-foreground">
        {filtered.length} campaign{filtered.length !== 1 ? "s" : ""}
        {search ? " (filtered)" : ""}
      </div>

      <div className="border rounded-lg divide-y">
        {filtered.map((campaign) => (
          <Link
            key={campaign.id}
            href={`/campaigns/${campaign.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {campaign.name}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                  {formatCampaignType(campaign.type)}
                </Badge>
              </div>
              {campaign.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {campaign.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {campaign._count.contacts}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {campaign._count.outreaches}
              </span>
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0 h-4 ${campaignStatusColors[campaign.status]}`}
              >
                {campaign.status}
              </Badge>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No campaigns match your search.
          </div>
        )}
      </div>
    </div>
  );
}
