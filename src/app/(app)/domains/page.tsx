import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Globe,
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { AddDomainDialog } from "./add-domain-dialog";
import { DomainActions } from "./domain-actions";

const warmupStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  NEW: {
    label: "New",
    className: "bg-secondary text-secondary-foreground",
  },
  WARMING: {
    label: "Warming",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  READY: {
    label: "Ready",
    className: "bg-green-500/15 text-green-700 dark:text-green-400",
  },
  PAUSED: {
    label: "Paused",
    className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  },
  FLAGGED: {
    label: "Flagged",
    className: "bg-red-500/15 text-red-700 dark:text-red-400",
  },
};

function getHealthColor(score: number): string {
  if (score > 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getHealthBarColor(score: number): string {
  if (score > 80) return "[&>div]:bg-green-500";
  if (score >= 50) return "[&>div]:bg-yellow-500";
  return "[&>div]:bg-red-500";
}

export default async function DomainsPage() {
  const { workspace } = await requireWorkspace();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const domains = await prisma.sendingDomain.findMany({
    where: { workspaceId: workspace.id },
    include: {
      warmupLogs: {
        where: { date: today },
        take: 1,
      },
      _count: {
        select: { outreaches: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sending Domains</h1>
          <p className="text-muted-foreground">
            Manage and warm up your sending domains for {workspace.name}.
          </p>
        </div>
        <AddDomainDialog />
      </div>

      {domains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No sending domains</h3>
            <p className="text-sm text-muted-foreground">
              Add your first sending domain to start warming up and sending
              outreach.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain: typeof domains[number]) => {
            const todayLog = domain.warmupLogs[0] ?? null;
            const todaySent = todayLog?.emailsSent ?? 0;
            const statusConfig = warmupStatusConfig[domain.warmupStatus] ?? warmupStatusConfig.NEW;
            const warmupProgress =
              domain.warmupStatus === "WARMING"
                ? Math.min(100, Math.round((domain.warmupDayNumber / 28) * 100))
                : domain.warmupStatus === "READY"
                  ? 100
                  : 0;

            return (
              <Card key={domain.id} className="h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-semibold leading-tight truncate">
                        {domain.domain}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {domain.emailAddress}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 ${statusConfig.className}`}
                    >
                      {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* DNS Status */}
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-2">
                      <DnsIndicator label="SPF" verified={domain.spfVerified} />
                      <DnsIndicator label="DKIM" verified={domain.dkimVerified} />
                      <DnsIndicator label="DMARC" verified={domain.dmarcVerified} />
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Health Score</span>
                      <span className={`font-medium ${getHealthColor(domain.healthScore)}`}>
                        {domain.healthScore}%
                      </span>
                    </div>
                    <Progress
                      value={domain.healthScore}
                      className={`h-2 ${getHealthBarColor(domain.healthScore)}`}
                    />
                  </div>

                  {/* Warmup Progress */}
                  {(domain.warmupStatus === "WARMING" ||
                    domain.warmupStatus === "PAUSED") && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Warmup Progress</span>
                        <span className="font-medium">
                          Day {domain.warmupDayNumber} of 28
                        </span>
                      </div>
                      <Progress value={warmupProgress} className="h-2" />
                    </div>
                  )}

                  {/* Daily Send Count */}
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {todaySent} / {domain.dailySendLimit} emails today
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <DomainActions
                    domainId={domain.id}
                    warmupStatus={domain.warmupStatus}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DnsIndicator({
  label,
  verified,
}: {
  label: string;
  verified: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {verified ? (
        <CheckCircle className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-400" />
      )}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
