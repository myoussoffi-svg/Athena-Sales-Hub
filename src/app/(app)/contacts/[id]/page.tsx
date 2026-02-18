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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  User,
  Briefcase,
  Search,
  Clock,
} from "lucide-react";
import { ContactStatusSelect } from "./contact-status-select";
import { DeleteContactButton } from "./delete-contact-button";
import { ResearchButton } from "./research-button";
import { MeetingDialog } from "./meeting-dialog";

interface OutreachItem {
  id: string;
  type: string;
  status: string;
  subject: string | null;
  sentAt: Date | null;
  scheduledAt: Date | null;
  createdAt: Date;
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

const outreachStatusColors: Record<string, string> = {
  SCHEDULED: "bg-secondary text-secondary-foreground",
  DRAFT_CREATED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  APPROVED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  SENDING: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  SENT: "bg-green-500/15 text-green-700 dark:text-green-400",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-400",
  CANCELLED: "bg-secondary text-muted-foreground",
};

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace } = await requireWorkspace();
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      campaign: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      outreaches: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          status: true,
          subject: true,
          sentAt: true,
          scheduledAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!contact) {
    notFound();
  }

  const researchData = contact.researchData as Record<string, string | string[]> | null;
  const hasResearch =
    researchData && !researchData.error && Object.keys(researchData).length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/contacts">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {contact.name}
            </h1>
            <Badge
              variant="secondary"
              className={contactStatusColors[contact.status]}
            >
              {formatContactStatus(contact.status)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{contact.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {contact.status === "REPLIED" && (
            <MeetingDialog contactId={contact.id} contactName={contact.name} />
          )}
          <ContactStatusSelect
            contactId={contact.id}
            currentStatus={contact.status}
          />
          <DeleteContactButton
            contactId={contact.id}
            contactName={contact.name}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={User} label="Name" value={contact.name} />
            <InfoRow icon={Mail} label="Email" value={contact.email} />
            {contact.title && (
              <InfoRow icon={Briefcase} label="Title" value={contact.title} />
            )}
            {contact.organization && (
              <InfoRow
                icon={Building2}
                label="Organization"
                value={contact.organization}
              />
            )}
            {contact.orgType && (
              <InfoRow
                icon={Building2}
                label="Type"
                value={contact.orgType}
              />
            )}
            {contact.location && (
              <InfoRow icon={MapPin} label="Location" value={contact.location} />
            )}
            {contact.websiteUrl && (
              <InfoRow
                icon={Globe}
                label="Website"
                value={contact.websiteUrl}
                href={contact.websiteUrl}
              />
            )}
            {contact.campaign && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Campaign</p>
                  <Link
                    href={`/campaigns/${contact.campaign.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {contact.campaign.name}
                  </Link>
                </div>
              </div>
            )}
            {contact.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Research Data Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Research</CardTitle>
              {!hasResearch && contact.websiteUrl && (
                <ResearchButton contactId={contact.id} />
              )}
            </div>
            {!hasResearch && (
              <CardDescription>
                {contact.websiteUrl
                  ? "Run research to gather data from the contact's website."
                  : "No website URL available for research."}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {hasResearch ? (
              <div className="space-y-3">
                {researchData.companyName && (
                  <ResearchField
                    label="Company"
                    value={researchData.companyName as string}
                  />
                )}
                {researchData.description && (
                  <ResearchField
                    label="Description"
                    value={researchData.description as string}
                  />
                )}
                {researchData.services &&
                  Array.isArray(researchData.services) &&
                  researchData.services.length > 0 && (
                    <ResearchField
                      label="Services"
                      value={(researchData.services as string[]).join(", ")}
                    />
                  )}
                {researchData.locations &&
                  Array.isArray(researchData.locations) &&
                  researchData.locations.length > 0 && (
                    <ResearchField
                      label="Locations"
                      value={(researchData.locations as string[]).join(", ")}
                    />
                  )}
                {researchData.teamInfo && (
                  <ResearchField
                    label="Team"
                    value={researchData.teamInfo as string}
                  />
                )}
                {researchData.industryDetails && (
                  <ResearchField
                    label="Industry"
                    value={researchData.industryDetails as string}
                  />
                )}
                {researchData.keyMessaging && (
                  <ResearchField
                    label="Key Messaging"
                    value={researchData.keyMessaging as string}
                  />
                )}
              </div>
            ) : researchData?.error ? (
              <div className="text-sm text-red-500">
                Research failed: {researchData.error as string}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2" />
                <p className="text-sm">No research data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outreach Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outreach History</CardTitle>
          <CardDescription>
            {contact.outreaches.length} outreach
            {contact.outreaches.length !== 1 ? "es" : ""} for this contact
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contact.outreaches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Mail className="h-8 w-8 mb-2" />
              <p className="text-sm">No outreach history yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(contact.outreaches as OutreachItem[]).map((outreach: OutreachItem, index: number) => (
                <div key={outreach.id} className="flex gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary mt-1.5" />
                    {index < contact.outreaches.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {formatOutreachType(outreach.type)}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={outreachStatusColors[outreach.status]}
                      >
                        {outreach.status}
                      </Badge>
                    </div>
                    {outreach.subject && (
                      <p className="text-sm font-medium mt-1">
                        {outreach.subject}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      {outreach.sentAt ? (
                        <span>
                          Sent{" "}
                          {new Date(outreach.sentAt).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      ) : outreach.scheduledAt ? (
                        <span>
                          Scheduled for{" "}
                          {new Date(outreach.scheduledAt).toLocaleDateString(
                            undefined,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      ) : (
                        <span>
                          Created{" "}
                          {new Date(outreach.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}

function ResearchField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function formatContactStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatOutreachType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
