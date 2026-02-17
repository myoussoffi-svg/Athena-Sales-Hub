"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WorkspaceSettingsProps {
  initialPrompt: string;
  initialCampaignTypes: string[];
  initialSettings: Record<string, unknown>;
}

export function WorkspaceSettings({
  initialPrompt,
  initialCampaignTypes,
  initialSettings,
}: WorkspaceSettingsProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [campaignTypes, setCampaignTypes] =
    useState<string[]>(initialCampaignTypes);
  const [newCampaignType, setNewCampaignType] = useState("");
  const [followUpDays, setFollowUpDays] = useState<number>(
    (initialSettings.followUpDays as number) ?? 5,
  );
  const [maxOutreach, setMaxOutreach] = useState<number>(
    (initialSettings.maxOutreach as number) ?? 3,
  );
  const [sendWindowStart, setSendWindowStart] = useState<number>(
    (initialSettings.sendWindowStart as number) ?? 8,
  );
  const [sendWindowEnd, setSendWindowEnd] = useState<number>(
    (initialSettings.sendWindowEnd as number) ?? 18,
  );
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingTypes, setSavingTypes] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  async function handleSavePrompt() {
    setSavingPrompt(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiSystemPrompt: prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      toast.success("AI system prompt saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveCampaignTypes(updatedTypes: string[]) {
    setSavingTypes(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignTypes: updatedTypes }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      toast.success("Campaign types updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingTypes(false);
    }
  }

  function handleAddCampaignType() {
    const trimmed = newCampaignType.trim();
    if (!trimmed) return;
    if (campaignTypes.includes(trimmed)) {
      toast.error("Campaign type already exists");
      return;
    }
    const updated = [...campaignTypes, trimmed];
    setCampaignTypes(updated);
    setNewCampaignType("");
    handleSaveCampaignTypes(updated);
  }

  function handleRemoveCampaignType(type: string) {
    const updated = campaignTypes.filter((t) => t !== type);
    setCampaignTypes(updated);
    handleSaveCampaignTypes(updated);
  }

  async function handleSaveDefaults() {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            followUpDays,
            maxOutreach,
            sendWindowStart,
            sendWindowEnd,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      toast.success("Default settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* AI System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI System Prompt</CardTitle>
          <CardDescription>
            This prompt is sent as context to the AI when generating outreach
            emails. Include information about your company, value proposition,
            and style guidelines.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={12}
            className="resize-none font-mono text-sm"
            placeholder="You are an outreach specialist for..."
          />
          <Button
            size="sm"
            onClick={handleSavePrompt}
            disabled={savingPrompt}
            className="gap-1.5"
          >
            {savingPrompt ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Prompt
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Campaign Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Types</CardTitle>
          <CardDescription>
            Define the types of campaigns you run. These appear when creating new
            campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {campaignTypes.map((type) => (
              <Badge
                key={type}
                variant="secondary"
                className="gap-1 pr-1 text-sm"
              >
                {type}
                <button
                  onClick={() => handleRemoveCampaignType(type)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  disabled={savingTypes}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {campaignTypes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No campaign types defined yet
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Executive Recruiting"
              value={newCampaignType}
              onChange={(e) => setNewCampaignType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCampaignType();
                }
              }}
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddCampaignType}
              disabled={savingTypes || !newCampaignType.trim()}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Default Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Settings</CardTitle>
          <CardDescription>
            Configure default parameters for outreach campaigns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="followUpDays" className="text-sm">
                Follow-up delay (days)
              </Label>
              <Input
                id="followUpDays"
                type="number"
                min={1}
                max={30}
                value={followUpDays}
                onChange={(e) => setFollowUpDays(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                Days between follow-up emails
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="maxOutreach" className="text-sm">
                Max outreach per contact
              </Label>
              <Input
                id="maxOutreach"
                type="number"
                min={1}
                max={10}
                value={maxOutreach}
                onChange={(e) => setMaxOutreach(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum emails before stopping
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sendWindowStart" className="text-sm">
                Send window start (hour)
              </Label>
              <Input
                id="sendWindowStart"
                type="number"
                min={0}
                max={23}
                value={sendWindowStart}
                onChange={(e) =>
                  setSendWindowStart(parseInt(e.target.value, 10))
                }
              />
              <p className="text-xs text-muted-foreground">
                e.g. 8 = 8:00 AM
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sendWindowEnd" className="text-sm">
                Send window end (hour)
              </Label>
              <Input
                id="sendWindowEnd"
                type="number"
                min={0}
                max={23}
                value={sendWindowEnd}
                onChange={(e) => setSendWindowEnd(parseInt(e.target.value, 10))}
              />
              <p className="text-xs text-muted-foreground">
                e.g. 18 = 6:00 PM
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSaveDefaults}
            disabled={savingSettings}
            className="gap-1.5"
          >
            {savingSettings ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Defaults
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
