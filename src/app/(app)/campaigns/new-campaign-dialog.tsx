"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

function formatCampaignType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface NewCampaignDialogProps {
  campaignTypes: string[];
}

export function NewCampaignDialog({ campaignTypes }: NewCampaignDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [followUp1Days, setFollowUp1Days] = useState(5);
  const [followUp2Days, setFollowUp2Days] = useState(14);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !type) return;

    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          cadenceConfig: {
            followUp1Days,
            followUp2Days,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      console.error("Failed to create campaign:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setType("");
    setDescription("");
    setFollowUp1Days(5);
    setFollowUp2Days(14);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Set up a new outreach campaign. You can add contacts after
              creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Q1 Bank Referral Outreach"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-type">Type</Label>
              <Select value={type} onValueChange={setType} required>
                <SelectTrigger id="campaign-type">
                  <SelectValue placeholder="Select campaign type" />
                </SelectTrigger>
                <SelectContent>
                  {campaignTypes.length > 0 ? (
                    campaignTypes.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {formatCampaignType(ct)}
                      </SelectItem>
                    ))
                  ) : (
                    <>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="bank_referral">
                        Bank Referral
                      </SelectItem>
                      <SelectItem value="roofing">Roofing</SelectItem>
                      <SelectItem value="insurance">Insurance</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                placeholder="Describe the campaign goals and target audience..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>Follow-up Cadence</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                  <Label
                    htmlFor="followup1"
                    className="text-sm text-muted-foreground whitespace-nowrap"
                  >
                    1st follow-up
                  </Label>
                  <Input
                    id="followup1"
                    type="number"
                    min={1}
                    max={30}
                    value={followUp1Days}
                    onChange={(e) =>
                      setFollowUp1Days(parseInt(e.target.value) || 5)
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Label
                    htmlFor="followup2"
                    className="text-sm text-muted-foreground whitespace-nowrap"
                  >
                    2nd follow-up
                  </Label>
                  <Input
                    id="followup2"
                    type="number"
                    min={1}
                    max={60}
                    value={followUp2Days}
                    onChange={(e) =>
                      setFollowUp2Days(parseInt(e.target.value) || 14)
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !type}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
