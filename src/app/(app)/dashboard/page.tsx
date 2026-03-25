import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { NewCampaignDialog } from "../campaigns/new-campaign-dialog";
import { DashboardCampaignList } from "./dashboard-campaign-list";

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

      {/* Per-campaign compact list */}
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
        <DashboardCampaignList campaigns={JSON.parse(JSON.stringify(campaignStats))} />
      )}
    </div>
  );
}
