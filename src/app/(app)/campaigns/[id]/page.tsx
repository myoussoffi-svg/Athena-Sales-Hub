import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Mail, Users, Zap } from "lucide-react";
import { CampaignStatusControls } from "./campaign-status-controls";

interface CampaignContact {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  status: string;
  lastContactedAt: Date | null;
}

const campaignStatusColors: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  ACTIVE: "bg-green-500/15 text-green-700 dark:text-green-400",
  PAUSED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

const contactStatusColors: Record<string, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  RESEARCHED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  OUTREACH_STARTED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  REPLIED: "bg-green-500/15 text-green-700 dark:text-green-400",
  MEETING_SCHEDULED: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  CONVERTED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  NOT_INTERESTED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      _count: { select: { contacts: true, outreaches: true } },
      createdBy: { select: { name: true } },
      contacts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          organization: true,
          status: true,
          lastContactedAt: true,
        },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const outreachSentCount = await prisma.outreach.count({
    where: {
      campaignId: id,
      status: "SENT",
      campaign: { workspaceId: workspace.id },
    },
  });

  const cadence = campaign.cadenceConfig as {
    followUp1Days?: number;
    followUp2Days?: number;
  } | null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {campaign.name}
            </h1>
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
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {campaign.description}
            </p>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Contacts</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {campaign._count.contacts}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Emails Sent</span>
            </div>
            <p className="text-2xl font-bold mt-1">{outreachSentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Total Outreaches
              </span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {campaign._count.outreaches}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Cadence</span>
            </div>
            <p className="text-sm font-medium mt-1">
              Day {cadence?.followUp1Days ?? 5}, Day{" "}
              {cadence?.followUp2Days ?? 14}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <CampaignStatusControls
          campaignId={campaign.id}
          currentStatus={campaign.status}
        />
        <Link href={`/outreach?campaignId=${campaign.id}`}>
          <Button variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Generate Outreach
          </Button>
        </Link>
        <Link href="/contacts">
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Add Contacts
          </Button>
        </Link>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
          <CardDescription>
            {campaign.contacts.length} contact
            {campaign.contacts.length !== 1 ? "s" : ""} in this campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaign.contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No contacts in this campaign yet.</p>
              <p className="text-sm mt-1">
                Add contacts from the{" "}
                <Link href="/contacts" className="text-primary underline">
                  contacts page
                </Link>
                .
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(campaign.contacts as CampaignContact[]).map((contact) => (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium hover:underline"
                      >
                        {contact.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.organization || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={contactStatusColors[contact.status]}
                      >
                        {formatContactStatus(contact.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.lastContactedAt
                        ? new Date(
                            contact.lastContactedAt,
                          ).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatCampaignType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatContactStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
