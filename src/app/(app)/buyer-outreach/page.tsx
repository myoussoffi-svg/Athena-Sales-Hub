import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isRecruitingWorkspace } from "@/lib/branding";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, ExternalLink, User } from "lucide-react";
import Link from "next/link";
import { RefreshDealsButton } from "./refresh-deals-button";
import { DraftBuyerButton } from "./draft-buyer-button";
import { DraftDealButton } from "./draft-deal-button";

const dealTypeLabels: Record<string, string> = {
  add_on: "Add-on",
  platform: "Platform",
  exit: "Exit",
  recap: "Recap",
  minority_investment: "Minority",
};

const dealTypeColors: Record<string, string> = {
  add_on: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  platform: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  exit: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  recap: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  minority_investment: "bg-stone-500/15 text-stone-700 dark:text-stone-400",
};

interface SponsorRow {
  sponsor: string;
  count: number;
  addOns: number;
  sectors: Set<string>;
  latest: Date;
  domain: string | null;
}

export default async function BuyerOutreachPage() {
  const { workspace } = await requireWorkspace();
  if (isRecruitingWorkspace(workspace.slug)) redirect("/dashboard");

  const WINDOW_DAYS = 90;
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const recentDeals = await prisma.deal.findMany({
    where: { announcedDate: { gte: since } },
    orderBy: { announcedDate: "desc" },
  });

  // Rank sponsors by acquisition velocity (add-ons + platform deals).
  const map = new Map<string, SponsorRow>();
  for (const d of recentDeals) {
    if (!d.sponsor) continue;
    if (d.dealType !== "add_on" && d.dealType !== "platform") continue;
    const row =
      map.get(d.sponsor) ??
      ({
        sponsor: d.sponsor,
        count: 0,
        addOns: 0,
        sectors: new Set<string>(),
        latest: d.announcedDate,
        domain: d.acquirerDomain,
      } satisfies SponsorRow);
    row.count++;
    if (d.dealType === "add_on") row.addOns++;
    if (d.industryLabel) row.sectors.add(d.industryLabel);
    if (d.announcedDate > row.latest) row.latest = d.announcedDate;
    map.set(d.sponsor, row);
  }
  const sponsors = [...map.values()]
    .sort((a, b) => b.count - a.count || b.latest.getTime() - a.latest.getTime())
    .slice(0, 15);

  const feed = recentDeals.slice(0, 30);
  const totalDeals = await prisma.deal.count();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buyer Finder</h1>
          <p className="text-sm text-muted-foreground">
            PE sponsors ranked by acquisition velocity, from Buyout Desk. Target
            the serial acquirers who need proprietary deal flow.
          </p>
        </div>
        <RefreshDealsButton />
      </div>

      {totalDeals === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <p>No deals yet.</p>
            <p className="text-sm mt-1">
              Click <span className="font-medium">Refresh deals</span> to pull
              the latest from Buyout Desk.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Deals tracked" value={totalDeals} />
            <StatCard
              label={`Sponsors active (${WINDOW_DAYS}d)`}
              value={sponsors.length}
            />
            <StatCard
              label={`Deals (${WINDOW_DAYS}d)`}
              value={recentDeals.length}
            />
          </div>

          {/* Recent deals feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Deals</CardTitle>
              <CardDescription>Latest transactions from the feed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {feed.map((d) => (
                <div
                  key={d.id}
                  className="flex items-start gap-3 rounded-lg border border-border/50 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{d.headline}</p>
                      <Badge
                        variant="secondary"
                        className={
                          (dealTypeColors[d.dealType] ?? "") + " text-xs"
                        }
                      >
                        {dealTypeLabels[d.dealType] ?? d.dealType}
                      </Badge>
                      {d.industryLabel && (
                        <Badge variant="outline" className="text-xs font-normal">
                          {d.industryLabel}
                        </Badge>
                      )}
                    </div>
                    {d.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {d.summary}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.sponsor ? `${d.sponsor} · ` : ""}
                      {new Date(d.announcedDate).toLocaleDateString()}
                    </p>
                    {d.contactName && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {d.contactName}
                          {d.contactTitle ? ` — ${d.contactTitle}` : ""}
                          {d.contactSourceType === "portco_executive"
                            ? " (portco)"
                            : ""}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.publicUrl && (
                      <Link
                        href={d.publicUrl}
                        target="_blank"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    {d.sponsor &&
                      (d.dealType === "platform" || d.dealType === "add_on") && (
                        <DraftDealButton dealId={d.id} sponsor={d.sponsor} />
                      )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Velocity leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                High-Velocity Sponsors
              </CardTitle>
              <CardDescription>
                Ranked by add-on + platform deals in the last {WINDOW_DAYS} days.
                Velocity builds as more days of deals accumulate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sponsors.map((s, i) => (
                <div
                  key={s.sponsor}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2"
                >
                  <span className="w-6 text-sm font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.sponsor}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[...s.sectors].join(", ") || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {s.count} deal{s.count !== 1 ? "s" : ""}
                    </Badge>
                    {s.addOns > 0 && (
                      <Badge
                        variant="secondary"
                        className={dealTypeColors.add_on + " text-xs"}
                      >
                        {s.addOns} add-on{s.addOns !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    <DraftBuyerButton sponsor={s.sponsor} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
