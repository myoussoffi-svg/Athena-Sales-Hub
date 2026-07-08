/**
 * Centralized, workspace-aware contact status configuration.
 *
 * No React or server-only imports — safe to use from both Server and Client
 * Components. Pass `isRecruiting` (true for Athena recruiting, false for Alta
 * buyside sourcing) to resolve brand-correct labels. The Prisma `ContactStatus`
 * enum is the source of truth for values; this module owns presentation only.
 */

export interface StatusMeta {
  color: string;
  athenaLabel: string;
  altaLabel: string;
  /** Recruiting-only statuses are hidden from buyside (Alta) selectors. */
  recruitingOnly?: boolean;
}

export const CONTACT_STATUS_META: Record<string, StatusMeta> = {
  NEW: {
    color: "bg-secondary text-secondary-foreground",
    athenaLabel: "New",
    altaLabel: "New",
  },
  RESEARCHED: {
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    athenaLabel: "Researched",
    altaLabel: "Researched",
  },
  OUTREACH_STARTED: {
    color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    athenaLabel: "Outreach Started",
    altaLabel: "Outreach Started",
  },
  REPLIED: {
    color: "bg-green-500/15 text-green-700 dark:text-green-400",
    athenaLabel: "Replied",
    altaLabel: "Replied",
  },
  MEETING_SCHEDULED: {
    color: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
    athenaLabel: "Athena Mtg Scheduled",
    altaLabel: "Intro Call Scheduled",
  },
  PRESENT_TO_CLIENT: {
    color: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
    athenaLabel: "Present to Client",
    altaLabel: "Present to Buyer",
  },
  MEETING_WITH_CLIENT: {
    color: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    athenaLabel: "Meeting with Client",
    altaLabel: "Meeting with Buyer",
  },
  FINAL_NEGOTIATIONS: {
    color: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
    athenaLabel: "Final Negotiations",
    altaLabel: "Final Negotiations",
  },
  CONVERTED: {
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    athenaLabel: "Converted",
    altaLabel: "Deal Closed",
  },
  CONVERTED_HIRED: {
    color: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    athenaLabel: "Converted - Hired",
    altaLabel: "Converted - Hired",
    recruitingOnly: true,
  },
  NOT_INTERESTED: {
    color: "bg-red-500/15 text-red-700 dark:text-red-400",
    athenaLabel: "Not Interested",
    altaLabel: "Not Interested",
  },
  BOUNCED: {
    color: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
    athenaLabel: "Bounced",
    altaLabel: "Bounced",
  },
  ATHENA_REJECTED: {
    color: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    athenaLabel: "Athena Rejected",
    altaLabel: "Disqualified",
  },
  CLIENT_REJECTED: {
    color: "bg-stone-500/15 text-stone-700 dark:text-stone-400",
    athenaLabel: "Client Rejected",
    altaLabel: "Buyer Passed",
  },
};

export const CONTACT_STATUSES = Object.keys(CONTACT_STATUS_META);

const DEFAULT_COLOR = "bg-secondary text-secondary-foreground";

export function statusColor(status: string): string {
  return CONTACT_STATUS_META[status]?.color ?? DEFAULT_COLOR;
}

export function statusLabel(status: string, isRecruiting: boolean): string {
  const meta = CONTACT_STATUS_META[status];
  if (!meta) {
    return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return isRecruiting ? meta.athenaLabel : meta.altaLabel;
}

/**
 * Status options for a selector/filter, hiding recruiting-only statuses for
 * buyside (Alta) and applying the brand-correct label to each.
 */
export function statusOptions(
  isRecruiting: boolean,
): { value: string; label: string }[] {
  return CONTACT_STATUSES.filter(
    (s) => isRecruiting || !CONTACT_STATUS_META[s].recruitingOnly,
  ).map((s) => ({ value: s, label: statusLabel(s, isRecruiting) }));
}
