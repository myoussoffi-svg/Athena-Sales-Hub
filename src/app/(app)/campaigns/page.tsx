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
import { Users, Mail, Calendar } from "lucide-react";
import { NewCampaignDialog } from "./new-campaign-dialog";

interface CampaignWithCounts {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
  createdAt: Date;
  _count: { contacts: number; outreaches: number };
  createdBy: { name: string | null } | null;
}

const campaignStatusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400",
  PAUSED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(campaigns as CampaignWithCounts[]).map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {campaign.name}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className={campaignStatusColors[campaign.status]}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline" className="text-xs font-normal">
                      {formatCampaignType(campaign.type)}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <CardDescription className="line-clamp-2 pt-1">
                      {campaign.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span>{campaign._count.contacts} contacts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{campaign._count.outreaches} emails</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                    <Calendar className="h-3 w-3" />
                    <span>
                      Created{" "}
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
                    {campaign.createdBy?.name && (
                      <span>by {campaign.createdBy.name}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function formatCampaignType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
