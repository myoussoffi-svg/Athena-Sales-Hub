"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, X, Pencil, Check, Loader2 } from "lucide-react";

interface CampaignLink {
  id: string;
  campaignId: string;
  note: string | null;
  campaign: { id: string; name: string; status: string };
}

interface Campaign {
  id: string;
  name: string;
}

interface CampaignManagerProps {
  contactId: string;
  campaignLinks: CampaignLink[];
  allCampaigns: Campaign[];
}

export function CampaignManager({
  contactId,
  campaignLinks,
  allCampaigns,
}: CampaignManagerProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [addNote, setAddNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const linkedCampaignIds = new Set(campaignLinks.map((cl) => cl.campaignId));
  const availableCampaigns = allCampaigns.filter(
    (c) => !linkedCampaignIds.has(c.id)
  );

  async function handleAdd() {
    if (!selectedCampaignId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          note: addNote.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add");
      toast.success("Added to campaign");
      setAdding(false);
      setSelectedCampaignId("");
      setAddNote("");
      router.refresh();
    } catch {
      toast.error("Failed to add to campaign");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateNote(campaignId: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/campaigns`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, note: editNote }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Note updated");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Failed to update note");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(campaignId: string) {
    setRemovingId(campaignId);
    try {
      const res = await fetch(
        `/api/contacts/${contactId}/campaigns?campaignId=${campaignId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Removed from campaign");
      router.refresh();
    } catch {
      toast.error("Failed to remove from campaign");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Campaigns</CardTitle>
            <CardDescription>
              {campaignLinks.length} campaign
              {campaignLinks.length !== 1 ? "s" : ""} assigned
            </CardDescription>
          </div>
          {!adding && availableCampaigns.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Campaign
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add form */}
        {adding && (
          <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1 space-y-2">
              <Select
                value={selectedCampaignId}
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Note (optional) e.g. 'approached, not a fit'"
                value={addNote}
                onChange={(e) => setAddNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setAdding(false);
                    setSelectedCampaignId("");
                    setAddNote("");
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!selectedCampaignId || saving}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Add"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setSelectedCampaignId("");
                setAddNote("");
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Campaign links */}
        {campaignLinks.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Not assigned to any campaigns yet.
          </p>
        )}
        {campaignLinks.map((cl) => (
          <div
            key={cl.id}
            className="flex items-start justify-between gap-2 p-3 rounded-lg border"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href={`/campaigns/${cl.campaign.id}`}
                  className="font-medium text-sm hover:underline"
                >
                  {cl.campaign.name}
                </Link>
                <Badge variant="outline" className="text-xs">
                  {cl.campaign.status}
                </Badge>
              </div>
              {editingId === cl.campaignId ? (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    autoFocus
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        handleUpdateNote(cl.campaignId);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    placeholder="Add a note..."
                    className="h-7 text-xs"
                  />
                  <button
                    onClick={() => handleUpdateNote(cl.campaignId)}
                    disabled={saving}
                    className="p-1 rounded hover:bg-muted"
                  >
                    {saving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3 text-green-600" />
                    )}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5 group">
                  <p className="text-xs text-muted-foreground truncate">
                    {cl.note || "No note"}
                  </p>
                  <button
                    onClick={() => {
                      setEditingId(cl.campaignId);
                      setEditNote(cl.note || "");
                    }}
                    className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100"
                  >
                    <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemove(cl.campaignId)}
              disabled={removingId === cl.campaignId}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
            >
              {removingId === cl.campaignId ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
