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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Trash2,
  Sparkles,
  FileText,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

interface VoiceSample {
  id: string;
  sampleText: string;
  createdAt: string;
}

interface VoiceTrainingProps {
  initialSamples: VoiceSample[];
  currentVoiceProfile: string;
}

export function VoiceTraining({
  initialSamples,
  currentVoiceProfile,
}: VoiceTrainingProps) {
  const [samples, setSamples] = useState<VoiceSample[]>(initialSamples);
  const [voiceProfile, setVoiceProfile] = useState(currentVoiceProfile);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSampleText, setNewSampleText] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function handleAddSample() {
    if (!newSampleText.trim()) return;

    setAdding(true);
    try {
      const res = await fetch("/api/settings/voice-samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sampleText: newSampleText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add sample");
      }

      const { sample } = await res.json();
      setSamples((prev) => [sample, ...prev]);
      setNewSampleText("");
      setDialogOpen(false);
      toast.success("Voice sample added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add sample");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/settings/voice-samples?id=${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete sample");
      }

      setSamples((prev) => prev.filter((s) => s.id !== id));
      toast.success("Voice sample removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete sample",
      );
    } finally {
      setDeleting(null);
    }
  }

  async function handleGenerateProfile() {
    if (samples.length === 0) {
      toast.error("Add at least one writing sample first");
      return;
    }

    setGenerating(true);
    try {
      // Call the voice profile generation endpoint through workspace settings
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { voiceProfileRequested: true },
        }),
      });

      // Generate profile on the client side by calling generate endpoint
      const profileRes = await fetch("/api/settings/voice-samples/generate", {
        method: "POST",
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error ?? "Failed to generate voice profile");
      }

      const { voiceProfile: newProfile } = await profileRes.json();
      setVoiceProfile(newProfile);
      toast.success("Voice profile generated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate profile",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Voice Training</CardTitle>
              <CardDescription>
                Teach the AI your writing style by adding examples of your best
                emails. Aim for 5-15 samples for the most accurate profile.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {samples.length} sample{samples.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Add Sample
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Add Writing Sample</DialogTitle>
                  <DialogDescription>
                    Paste an email you have written. The AI will analyze your
                    writing patterns to match your style in generated outreach.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  placeholder="Paste one of your best outreach emails here..."
                  value={newSampleText}
                  onChange={(e) => setNewSampleText(e.target.value)}
                  rows={12}
                  className="resize-none"
                />
                <DialogFooter>
                  <Button
                    onClick={handleAddSample}
                    disabled={adding || !newSampleText.trim()}
                  >
                    {adding ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Sample"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={handleGenerateProfile}
              disabled={generating || samples.length === 0}
            >
              {generating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate Voice Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Voice Profile */}
      {voiceProfile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Current Voice Profile
            </CardTitle>
            <CardDescription>
              This profile is used when generating all your outreach emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {voiceProfile}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sample List */}
      {samples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Writing Samples</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {samples.map((sample, index) => (
              <div key={sample.id}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm line-clamp-3 leading-relaxed">
                      {sample.sampleText.slice(0, 200)}
                      {sample.sampleText.length > 200 ? "..." : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Added{" "}
                      {new Date(sample.createdAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(sample.id)}
                    disabled={deleting === sample.id}
                  >
                    {deleting === sample.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {samples.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">No writing samples yet</p>
            <p className="text-xs mt-1">
              Add your best outreach emails so the AI can learn your writing
              style
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
