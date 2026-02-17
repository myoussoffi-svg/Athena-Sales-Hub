import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { ContactStatus } from "@/generated/prisma/client";
import Link from "next/link";
import {
  Card,
  CardContent,
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
import { Users } from "lucide-react";
import { ContactsToolbar } from "./contacts-toolbar";
import { UploadDialog } from "./upload-dialog";
import { AddContactDialog } from "./add-contact-dialog";

interface ContactWithRelations {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  status: string;
  lastContactedAt: Date | null;
  campaign: { id: string; name: string } | null;
  _count: { outreaches: number };
}

const contactStatusColors: Record<string, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  RESEARCHED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  OUTREACH_STARTED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  REPLIED: "bg-green-500/15 text-green-700 dark:text-green-400",
  MEETING_SCHEDULED: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  CONVERTED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  NOT_INTERESTED: "bg-red-500/15 text-red-700 dark:text-red-400",
  BOUNCED: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

interface ContactsPageProps {
  searchParams: Promise<{
    search?: string;
    campaignId?: string;
    status?: string;
  }>;
}

export default async function ContactsPage({
  searchParams,
}: ContactsPageProps) {
  const { workspace } = await requireWorkspace();
  const { search, campaignId, status } = await searchParams;

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: workspace.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const where = {
    workspaceId: workspace.id,
    ...(campaignId && { campaignId }),
    ...(status && { status: status as ContactStatus }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { email: { contains: search, mode: "insensitive" as const } },
        { organization: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      campaign: { select: { id: true, name: true } },
      _count: { select: { outreaches: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted-foreground">
            Manage contacts across all campaigns.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadDialog campaigns={campaigns} />
          <AddContactDialog campaigns={campaigns} />
        </div>
      </div>

      <ContactsToolbar
        campaigns={campaigns}
        currentSearch={search}
        currentCampaignId={campaignId}
        currentStatus={status}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            {search || campaignId || status ? " (filtered)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-1">No contacts found</h3>
              <p className="text-sm text-muted-foreground">
                {search || campaignId || status
                  ? "Try adjusting your filters."
                  : "Upload a CSV or add contacts manually."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Contacted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(contacts as unknown as ContactWithRelations[]).map((contact) => (
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
                      {contact.campaign ? (
                        <Link
                          href={`/campaigns/${contact.campaign.id}`}
                          className="text-sm hover:underline"
                        >
                          {contact.campaign.name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
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

function formatContactStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
