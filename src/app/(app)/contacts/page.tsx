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
      assignedTo: { select: { id: true, name: true, email: true } },
      campaignLinks: {
        include: { campaign: { select: { id: true, name: true } } },
        orderBy: { addedAt: "desc" },
      },
      _count: { select: { outreaches: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Detect duplicates by name + organization (case-insensitive)
  const dupeKeys = new Set<string>();
  const seen = new Map<string, number>();
  for (const c of contacts) {
    const key = `${(c.name || "").toLowerCase().trim()}::${(c.organization || "").toLowerCase().trim()}`;
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) dupeKeys.add(key);
  }
  const duplicateIds = new Set(
    contacts
      .filter((c) => {
        const key = `${(c.name || "").toLowerCase().trim()}::${(c.organization || "").toLowerCase().trim()}`;
        return dupeKeys.has(key);
      })
      .map((c) => c.id)
  );

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
              duplicateIds={Array.from(duplicateIds)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
