import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Sparkles, Clock, ArrowRight, Send } from "lucide-react";
import { GenerateDialog } from "./generate-dialog";

interface OutreachWithRelations {
  id: string;
  subject: string | null;
  type: string;
  status: string;
  personalizationScore: string | null;
  createdAt: Date;
  sentAt: Date | null;
  contact: {
    id: string;
    name: string;
    email: string;
    title: string | null;
    organization: string | null;
  };
  campaign: {
    id: string;
    name: string;
  } | null;
}

const outreachStatusColors: Record<string, string> = {
  SENT: "bg-green-500/15 text-green-700 dark:text-green-400",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const scoreColors: Record<string, string> = {
  HIGH: "bg-green-500/15 text-green-700 dark:text-green-400",
  MEDIUM: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  LOW: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const typeLabels: Record<string, string> = {
  INITIAL: "Initial",
  FOLLOWUP_1: "Follow-up 1",
  FOLLOWUP_2: "Follow-up 2",
  MEETING_REQUEST: "Meeting",
  REPLY: "Reply",
};

export default async function OutreachQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string; status?: string }>;
}) {
  const { user, workspace } = await requireWorkspace();
  const resolvedParams = await searchParams;
  const campaignId = resolvedParams.campaignId;
  const statusParam = resolvedParams.status;
  const isSentView = statusParam === "SENT";

  // Load active campaigns for the generate dialog
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id, status: "ACTIVE" },
    select: { id: true, name: true, type: true },
    orderBy: { name: "asc" },
  });

  // Load campaign name if filtering
  let campaignName: string | null = null;
  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: workspace.id },
      select: { name: true },
    });
    campaignName = campaign?.name ?? null;
  }

  // Load outreaches
  const outreaches = await prisma.outreach.findMany({
    where: {
      userId: user.id,
      status: isSentView ? { in: ["SENT", "FAILED"] } : "DRAFT_CREATED",
      campaign: {
        workspaceId: workspace.id,
      },
      ...(campaignId && { campaignId }),
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          organization: true,
        },
      },
      campaign: {
        select: { id: true, name: true },
      },
    },
    orderBy: isSentView ? { sentAt: "desc" } : { createdAt: "desc" },
  });

  const pageTitle = isSentView ? "Sent Emails" : "Outreach Queue";
  const pageDescription = isSentView
    ? "Emails that have been sent."
    : "Review and approve AI-generated emails before sending.";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-muted-foreground">{pageDescription}</p>
        </div>
        {!isSentView && <GenerateDialog campaigns={campaigns} />}
      </div>

      {/* Summary bar */}
      {!isSentView && outreaches.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">
                {outreaches.length} email{outreaches.length !== 1 ? "s" : ""} to
                review
                {campaignName && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    for {campaignName}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Use keyboard shortcuts in the review page for faster processing
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outreach list */}
      {outreaches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            {isSentView ? (
              <Send className="h-12 w-12 text-muted-foreground mb-4" />
            ) : (
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            )}
            <h3 className="text-lg font-semibold mb-1">
              {isSentView ? "No sent emails" : "No emails to review"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isSentView
                ? "No emails have been sent yet for this campaign."
                : "Generate outreach emails for a campaign to start reviewing."}
            </p>
            {!isSentView && <GenerateDialog campaigns={campaigns} />}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isSentView ? "Sent" : "Pending Review"}
              {campaignName && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  — {campaignName}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {isSentView
                ? `${outreaches.length} email${outreaches.length !== 1 ? "s" : ""} sent.`
                : "Click on any email to open the full review experience."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  {isSentView ? (
                    <TableHead>Status</TableHead>
                  ) : (
                    <TableHead>Score</TableHead>
                  )}
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">
                    {isSentView ? "Sent" : "Created"}
                  </TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(outreaches as OutreachWithRelations[]).map((outreach) => (
                  <TableRow key={outreach.id} className="group">
                    <TableCell>
                      <Link
                        href={`/outreach/${outreach.id}`}
                        className="block"
                      >
                        <div className="font-medium">
                          {outreach.contact.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {outreach.contact.organization
                            ? `${outreach.contact.title ?? ""} ${outreach.contact.title && outreach.contact.organization ? "at" : ""} ${outreach.contact.organization}`.trim()
                            : outreach.contact.email}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <Link
                        href={`/outreach/${outreach.id}`}
                        className="block truncate text-sm"
                      >
                        {outreach.subject ?? "No subject"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {typeLabels[outreach.type] ?? outreach.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isSentView ? (
                        <Badge
                          variant="secondary"
                          className={
                            outreachStatusColors[outreach.status] ?? ""
                          }
                        >
                          {outreach.status === "FAILED" ? "Bounced" : "Sent"}
                        </Badge>
                      ) : (
                        outreach.personalizationScore && (
                          <Badge
                            variant="secondary"
                            className={
                              scoreColors[outreach.personalizationScore] ?? ""
                            }
                          >
                            {outreach.personalizationScore}
                          </Badge>
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {outreach.campaign?.name ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(
                          isSentView && outreach.sentAt
                            ? outreach.sentAt
                            : outreach.createdAt
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/outreach/${outreach.id}`}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
