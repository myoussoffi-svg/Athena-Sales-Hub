import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Globe,
  Mail,
  MapPin,
  User,
  Briefcase,
  Sparkles,
  Target,
  MessageSquare,
  Clock,
} from "lucide-react";
import { ReviewActions } from "./review-actions";
import { EmailEditor } from "./email-editor";

const scoreConfig: Record<
  string,
  { label: string; color: string; dotColor: string }
> = {
  HIGH: {
    label: "High",
    color: "bg-green-500/15 text-green-700 dark:text-green-400",
    dotColor: "bg-green-500",
  },
  MEDIUM: {
    label: "Medium",
    color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    dotColor: "bg-yellow-500",
  },
  LOW: {
    label: "Low",
    color: "bg-red-500/15 text-red-700 dark:text-red-400",
    dotColor: "bg-red-500",
  },
};

const typeLabels: Record<string, string> = {
  INITIAL: "Initial Outreach",
  FOLLOWUP_1: "Follow-up 1",
  FOLLOWUP_2: "Follow-up 2",
  MEETING_REQUEST: "Meeting Request",
  REPLY: "Reply",
};

export default async function OutreachReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, workspace } = await requireWorkspace();
  const { id } = await params;

  // Load the outreach with full context
  const outreach = await prisma.outreach.findFirst({
    where: {
      id,
      campaign: { workspaceId: workspace.id },
    },
    include: {
      contact: true,
      campaign: { select: { id: true, name: true, type: true } },
      parentOutreach: {
        select: {
          id: true,
          subject: true,
          bodyPlain: true,
          sentAt: true,
          type: true,
        },
      },
    },
  });

  if (!outreach) {
    notFound();
  }

  // Load queue for navigation: all DRAFT_CREATED outreaches for this user
  const queue = await prisma.outreach.findMany({
    where: {
      userId: user.id,
      status: "DRAFT_CREATED",
      campaign: { workspaceId: workspace.id },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  const queueIds = queue.map((o: { id: string }) => o.id);
  const currentIndex = queueIds.indexOf(id);
  const prevId = currentIndex > 0 ? queueIds[currentIndex - 1] : null;
  const nextId =
    currentIndex < queueIds.length - 1 ? queueIds[currentIndex + 1] : null;

  const subjectVariants = (outreach.subjectVariants as string[]) ?? [
    outreach.subject ?? "",
  ];
  const researchData = outreach.contact.researchData as Record<
    string,
    string | string[]
  > | null;
  const hasResearch =
    researchData &&
    !researchData.error &&
    Object.keys(researchData).length > 0;
  const score = outreach.personalizationScore
    ? scoreConfig[outreach.personalizationScore]
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Top nav bar */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3 flex items-center gap-3 shrink-0">
        <Link href="/outreach">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            {typeLabels[outreach.type] ?? outreach.type}
          </Badge>
          {score && (
            <Badge variant="secondary" className={score.color}>
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${score.dotColor}`}
              />
              {score.label} Personalization
            </Badge>
          )}
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          {outreach.contact.name} &middot; {outreach.contact.email}
        </div>
      </div>

      {/* Main content: two columns */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6 max-w-[1400px] mx-auto">
          {/* ─── Left Column: The Email ─── */}
          <div className="space-y-4">
            {/* Subject line variants */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Subject Line
              </label>
              <EmailEditor
                outreachId={outreach.id}
                initialSubject={outreach.subject ?? ""}
                initialBodyHtml={outreach.bodyHtml ?? ""}
                subjectVariants={subjectVariants}
              />
            </div>

            {/* Personalization hook */}
            {outreach.hookUsed && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <Target className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-primary mb-0.5">
                    Personalization Hook
                  </p>
                  <p className="text-sm">{outreach.hookUsed}</p>
                </div>
              </div>
            )}

            {/* Tone */}
            {outreach.tone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>
                  Tone: <span className="font-medium">{outreach.tone}</span>
                </span>
              </div>
            )}
          </div>

          {/* ─── Right Column: Context ─── */}
          <div className="space-y-4">
            {/* Contact card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-semibold">{outreach.contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {outreach.contact.email}
                  </p>
                </div>
                {outreach.contact.title && (
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    {outreach.contact.title}
                  </div>
                )}
                {outreach.contact.organization && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {outreach.contact.organization}
                    {outreach.contact.orgType && (
                      <span className="text-muted-foreground">
                        ({outreach.contact.orgType})
                      </span>
                    )}
                  </div>
                )}
                {outreach.contact.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {outreach.contact.location}
                  </div>
                )}
                {outreach.contact.websiteUrl && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={outreach.contact.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {outreach.contact.websiteUrl.replace(
                        /^https?:\/\/(www\.)?/,
                        "",
                      )}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Research brief */}
            {hasResearch && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Research Brief
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {researchData.companyName && (
                    <ResearchItem
                      label="Company"
                      value={researchData.companyName as string}
                    />
                  )}
                  {researchData.description && (
                    <ResearchItem
                      label="About"
                      value={researchData.description as string}
                    />
                  )}
                  {researchData.services &&
                    Array.isArray(researchData.services) && (
                      <ResearchItem
                        label="Services"
                        value={(researchData.services as string[]).join(", ")}
                      />
                    )}
                  {researchData.locations &&
                    Array.isArray(researchData.locations) && (
                      <ResearchItem
                        label="Locations"
                        value={(researchData.locations as string[]).join(", ")}
                      />
                    )}
                  {researchData.teamInfo && (
                    <ResearchItem
                      label="Team"
                      value={researchData.teamInfo as string}
                    />
                  )}
                  {researchData.industryDetails && (
                    <ResearchItem
                      label="Industry"
                      value={researchData.industryDetails as string}
                    />
                  )}
                  {researchData.keyMessaging && (
                    <ResearchItem
                      label="Key Messaging"
                      value={researchData.keyMessaging as string}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Campaign info */}
            {outreach.campaign && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Campaign
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium text-sm">
                    {outreach.campaign.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatType(outreach.campaign.type)}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Previous outreach */}
            {outreach.parentOutreach && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Previous Outreach
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">
                      {outreach.parentOutreach.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[outreach.parentOutreach.type] ??
                        outreach.parentOutreach.type}
                      {outreach.parentOutreach.sentAt && (
                        <>
                          {" "}
                          &middot; Sent{" "}
                          {new Date(
                            outreach.parentOutreach.sentAt,
                          ).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                  {outreach.parentOutreach.bodyPlain && (
                    <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">
                      {outreach.parentOutreach.bodyPlain}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Fixed action bar */}
      <ReviewActions
        outreachId={outreach.id}
        hookUsed={outreach.hookUsed ?? ""}
        prevId={prevId}
        nextId={nextId}
        currentIndex={currentIndex + 1}
        totalCount={queueIds.length}
      />
    </div>
  );
}

function ResearchItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-sm leading-snug">{value}</p>
    </div>
  );
}

function formatType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
