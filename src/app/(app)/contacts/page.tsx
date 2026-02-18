import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { ContactStatus } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users } from "lucide-react";
import { ContactsToolbar } from "./contacts-toolbar";
import { ContactsTable } from "./contacts-table";
import { UploadDialog } from "./upload-dialog";
import { AddContactDialog } from "./add-contact-dialog";

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
            <ContactsTable
              contacts={JSON.parse(JSON.stringify(contacts))}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
