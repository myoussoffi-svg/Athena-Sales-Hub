import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Mail } from "lucide-react";
import { NewCampaignDialog } from "./new-campaign-dialog";
import { CampaignList } from "./campaign-list";

export default async function CampaignsPage() {
  const { workspace } = await requireWorkspace();

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    include: {
      _count: {
        select: {
          contacts: true,
          outreaches: true,
        },
      },
      createdBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const campaignTypes = (workspace.campaignTypes as string[]) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">
            Manage your outreach campaigns for {workspace.name}.
          </p>
        </div>
        <NewCampaignDialog campaignTypes={campaignTypes} />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground">
              Create your first campaign to start reaching out to contacts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <CampaignList campaigns={JSON.parse(JSON.stringify(campaigns))} />
      )}
    </div>
  );
}
