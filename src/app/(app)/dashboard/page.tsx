import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Users, MessageSquare, Reply, Megaphone } from "lucide-react";
import { NewCampaignDialog } from "../campaigns/new-campaign-dialog";

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

export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspace();

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch per-campaign stats in parallel
  const campaignStats = await Promise.all(
    campaigns.map(async (campaign) => {
      const [contacts, emailsSent, pendingReview, replies] = await Promise.all([
        prisma.contact.count({
          where: { workspaceId: workspace.id, campaignId: campaign.id },
        }),
        prisma.outreach.count({
          where: {
            campaignId: campaign.id,
            userId: user.id,
            status: "SENT",
          },
        }),
        prisma.outreach.count({
          where: {
            campaignId: campaign.id,
            userId: user.id,
            status: { in: ["DRAFT_CREATED", "APPROVED"] },
          },
        }),
        prisma.contact.count({
          where: {
            workspaceId: workspace.id,
            campaignId: campaign.id,
            status: "REPLIED",
          },
        }),
      ]);

      return { ...campaign, contacts, emailsSent, pendingReview, replies };
    })
  );

  const totalContacts = campaignStats.reduce((sum, c) => sum + c.contacts, 0);
  const totalSent = campaignStats.reduce((sum, c) => sum + c.emailsSent, 0);

  const campaignTypes = (workspace.campaignTypes as string[]) || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back. Here&apos;s your {workspace.name} overview.
          </p>
        </div>
        <NewCampaignDialog campaignTypes={campaignTypes} />
      </div>

      {/* Workspace totals */}
      <p className="text-sm text-muted-foreground">
        {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} &middot;{" "}
        {totalContacts} contact{totalContacts !== 1 ? "s" : ""} &middot;{" "}
        {totalSent} email{totalSent !== 1 ? "s" : ""} sent
      </p>

      {/* Per-campaign sections */}
      {campaignStats.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first campaign to get started.
            </p>
            <NewCampaignDialog campaignTypes={campaignTypes} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaignStats.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="text-base font-semibold hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <Badge
                    variant="secondary"
                    className={campaignStatusColors[campaign.status]}
                  >
                    {campaign.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal">
                    {formatCampaignType(campaign.type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  {/* Contacts */}
                  <Link
                    href={`/contacts?campaignId=${campaign.id}`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          Contacts
                        </CardTitle>
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold">
                          {campaign.contacts}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Emails Sent */}
                  <Link
                    href={`/outreach?campaignId=${campaign.id}&status=SENT`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          Emails Sent
                        </CardTitle>
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold">
                          {campaign.emailsSent}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Pending Review */}
                  <Link
                    href={`/outreach?campaignId=${campaign.id}`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          Pending Review
                        </CardTitle>
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold">
                          {campaign.pendingReview}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>

                  {/* Replies */}
                  <Link
                    href={`/contacts?campaignId=${campaign.id}&status=REPLIED`}
                    className="block"
                  >
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          Replies
                        </CardTitle>
                        <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent className="px-4 pb-4 pt-0">
                        <div className="text-2xl font-bold">
                          {campaign.replies}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
