"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RefreshCw, Loader2, AlertTriangle, Pencil, Check, X, Star } from "lucide-react";
import { StarRating } from "@/components/ui/star-rating";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CampaignLink {
  id: string;
  campaignId: string;
  note: string | null;
  campaign: { id: string; name: string };
}

interface Contact {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  notes: string | null;
  linkedinUrl: string | null;
  isAthenaMentor: boolean;
  rating: number | null;
  status: string;
  lastContactedAt: Date | null;
  campaign: { id: string; name: string } | null;
  campaignLinks: CampaignLink[];
  assignedTo: { id: string; name: string | null; email: string } | null;
  _count: { outreaches: number };
}

const contactStatusColors: Record<string, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  RESEARCHED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  OUTREACH_STARTED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  REPLIED: "bg-green-500/15 text-green-700 dark:text-green-400",
  MEETING_SCHEDULED: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  CONVERTED: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  CONVERTED_HIRED: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  NOT_INTERESTED: "bg-red-500/15 text-red-700 dark:text-red-400",
  BOUNCED: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  ATHENA_REJECTED: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  CLIENT_REJECTED: "bg-stone-500/15 text-stone-700 dark:text-stone-400",
};

const ALL_STATUSES = [
  "NEW",
  "RESEARCHED",
  "OUTREACH_STARTED",
  "REPLIED",
  "MEETING_SCHEDULED",
  "CONVERTED",
  "CONVERTED_HIRED",
  "NOT_INTERESTED",
  "BOUNCED",
  "ATHENA_REJECTED",
  "CLIENT_REJECTED",
];

function formatContactStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function InlineStarRating({ contactId, initialRating, onSaved }: { contactId: string; initialRating: number | null; onSaved: () => void }) {
  const [rating, setRating] = useState(initialRating);

  async function handleChange(newRating: number | null) {
    setRating(newRating);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: newRating }),
      });
      if (!res.ok) throw new Error("Failed to save");
      onSaved();
    } catch {
      setRating(initialRating);
      toast.error("Failed to save rating");
    }
  }

  return <StarRating value={rating} onChange={handleChange} />;
}

function EditableNotesCell({ contactId, initialNotes, onSaved }: { contactId: string; initialNotes: string | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Notes saved");
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-start gap-1 min-w-[200px]">
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === "Escape") { setValue(initialNotes || ""); setEditing(false); }
          }}
          className="flex-1 text-sm border rounded px-2 py-1 min-h-[60px] resize-y bg-background"
          placeholder="Add notes..."
        />
        <div className="flex flex-col gap-0.5 pt-0.5">
          <button onClick={save} disabled={saving} className="p-0.5 rounded hover:bg-muted">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
          </button>
          <button onClick={() => { setValue(initialNotes || ""); setEditing(false); }} className="p-0.5 rounded hover:bg-muted">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="flex items-center gap-1 cursor-pointer group min-w-[150px] max-w-[250px]"
    >
      <span className="text-sm truncate">
        {initialNotes || <span className="text-muted-foreground italic">Add notes...</span>}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
    </div>
  );
}

export function ContactsTable({ contacts, duplicateIds = [] }: { contacts: Contact[]; duplicateIds?: string[] }) {
  const duplicateSet = new Set(duplicateIds);
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const allSelected = contacts.length > 0 && selected.size === contacts.length;
  const someSelected = selected.size > 0 && selected.size < contacts.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelected(next);
  }

  async function handleBulkDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selected),
          action: "delete",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete contacts");
      }

      const data = await res.json();
      toast.success(`Deleted ${data.deleted} contact${data.deleted !== 1 ? "s" : ""}`);
      setSelected(new Set());
      setShowDeleteDialog(false);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete contacts",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleBulkStatus(status: string) {
    setIsUpdating(true);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selected),
          action: "update_status",
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update contacts");
      }

      const data = await res.json();
      toast.success(
        `Updated ${data.updated} contact${data.updated !== 1 ? "s" : ""} to ${formatContactStatus(status)}`,
      );
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update contacts",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <>
      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5 mb-3">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="h-4 w-px bg-border" />

          {/* Status update */}
          <Select
            onValueChange={handleBulkStatus}
            disabled={isUpdating}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <div className="flex items-center gap-1.5">
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                <SelectValue placeholder="Update status..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatContactStatus(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Delete */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="h-8 text-xs ml-auto"
          >
            Clear selection
          </Button>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>Last Contacted</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow
              key={contact.id}
              className={`hover:bg-muted/50 ${selected.has(contact.id) ? "bg-muted/30" : ""}`}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(contact.id)}
                  onCheckedChange={() => toggleOne(contact.id)}
                  aria-label={`Select ${contact.name}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/contacts/${contact.id}`}
                    className="font-medium hover:underline"
                  >
                    {contact.name}
                  </Link>
                  {duplicateSet.has(contact.id) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Possible duplicate (same name + organization)</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.email}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.organization || "-"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.assignedTo?.name || contact.assignedTo?.email || "-"}
              </TableCell>
              <TableCell>
                {contact.campaignLinks && contact.campaignLinks.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {contact.campaignLinks.map((cl) => (
                      <TooltipProvider key={cl.id}>
                        <Tooltip>
                          <TooltipTrigger>
                            <Link href={`/campaigns/${cl.campaign.id}`}>
                              <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                                {cl.campaign.name}
                              </Badge>
                            </Link>
                          </TooltipTrigger>
                          {cl.note && (
                            <TooltipContent>
                              <p>{cl.note}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                ) : contact.campaign ? (
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
              <TableCell>
                <InlineStarRating
                  contactId={contact.id}
                  initialRating={contact.rating}
                  onSaved={() => router.refresh()}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {contact.lastContactedAt
                  ? new Date(contact.lastContactedAt).toLocaleDateString()
                  : "Never"}
              </TableCell>
              <TableCell>
                <EditableNotesCell
                  contactId={contact.id}
                  initialNotes={contact.notes}
                  onSaved={() => router.refresh()}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} contact{selected.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contacts and all their
              associated outreach emails. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {selected.size} contact{selected.size !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
