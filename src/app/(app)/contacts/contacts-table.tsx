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
import { Trash2, RefreshCw, Loader2 } from "lucide-react";

interface Contact {
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

const ALL_STATUSES = [
  "NEW",
  "RESEARCHED",
  "OUTREACH_STARTED",
  "REPLIED",
  "MEETING_SCHEDULED",
  "CONVERTED",
  "NOT_INTERESTED",
  "BOUNCED",
];

function formatContactStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ContactsTable({ contacts }: { contacts: Contact[] }) {
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
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Contacted</TableHead>
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
                  ? new Date(contact.lastContactedAt).toLocaleDateString()
                  : "Never"}
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
