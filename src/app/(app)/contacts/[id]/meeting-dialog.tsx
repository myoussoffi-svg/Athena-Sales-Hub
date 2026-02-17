"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  Loader2,
  CheckCircle,
  Send,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BusySlot {
  start: string;
  end: string;
}

interface MeetingDialogProps {
  contactId: string;
  contactName: string;
}

type Step = "availability" | "review" | "confirmed";

export function MeetingDialog({ contactId, contactName }: MeetingDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("availability");
  const [loading, setLoading] = useState(false);
  const [busySlots, setBusySlots] = useState<BusySlot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState<{
    id: string;
    subject: string;
    bodyHtml: string;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmTime, setConfirmTime] = useState("");
  const [duration, setDuration] = useState(30);

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/meeting`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to load availability");
      }
      const data = await res.json();
      setBusySlots(data.busySlots);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load availability",
      );
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (open) {
      setStep("availability");
      setSelectedSlots([]);
      setOutreach(null);
      setConfirmTime("");
      fetchAvailability();
    }
  }, [open, fetchAvailability]);

  // Generate available time slots for next 2 weeks (9 AM - 5 PM business hours)
  function getAvailableSlots(): Array<{
    date: string;
    slots: Array<{ time: string; iso: string; busy: boolean }>;
  }> {
    const days: Array<{
      date: string;
      slots: Array<{ time: string; iso: string; busy: boolean }>;
    }> = [];

    const now = new Date();

    for (let d = 1; d <= 14; d++) {
      const date = new Date(now);
      date.setDate(date.getDate() + d);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      const daySlots: Array<{ time: string; iso: string; busy: boolean }> = [];

      for (let hour = 9; hour <= 16; hour++) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(hour + 1, 0, 0, 0);

        // Check if this slot overlaps with any busy slot
        const isBusy = busySlots.some((busy) => {
          const busyStart = new Date(busy.start);
          const busyEnd = new Date(busy.end);
          return slotStart < busyEnd && slotEnd > busyStart;
        });

        daySlots.push({
          time: slotStart.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }),
          iso: slotStart.toISOString(),
          busy: isBusy,
        });
      }

      days.push({
        date: date.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        slots: daySlots,
      });
    }

    return days;
  }

  function toggleSlot(iso: string) {
    setSelectedSlots((prev) => {
      if (prev.includes(iso)) {
        return prev.filter((s) => s !== iso);
      }
      if (prev.length >= 3) {
        toast.error("You can propose up to 3 time slots");
        return prev;
      }
      return [...prev, iso];
    });
  }

  async function handleGenerateRequest() {
    if (selectedSlots.length === 0) {
      toast.error("Select at least one time slot");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/meeting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposedTimes: selectedSlots }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to generate meeting request");
      }

      const data = await res.json();
      setOutreach(data.outreach);
      setStep("review");
      toast.success("Meeting request email generated");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to generate meeting request",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleConfirmMeeting() {
    if (!confirmTime) {
      toast.error("Enter the confirmed meeting time");
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/meeting/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedTime: confirmTime, duration }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to confirm meeting");
      }

      setStep("confirmed");
      toast.success("Meeting scheduled and calendar event created");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to confirm meeting",
      );
    } finally {
      setConfirming(false);
    }
  }

  const availableDays = getAvailableSlots();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          Schedule Meeting
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "availability" && `Schedule Meeting with ${contactName}`}
            {step === "review" && "Review Meeting Request"}
            {step === "confirmed" && "Meeting Scheduled"}
          </DialogTitle>
          <DialogDescription>
            {step === "availability" &&
              "Select 2-3 available time slots to propose. Busy times are grayed out."}
            {step === "review" &&
              "Review the AI-generated meeting request email before sending."}
            {step === "confirmed" &&
              "The meeting has been created in your Outlook calendar."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Availability */}
        {step === "availability" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading calendar...
                </span>
              </div>
            ) : (
              <>
                {selectedSlots.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">
                      Selected:
                    </span>
                    {selectedSlots.map((iso) => (
                      <Badge
                        key={iso}
                        variant="default"
                        className="gap-1 cursor-pointer"
                        onClick={() => toggleSlot(iso)}
                      >
                        {new Date(iso).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {availableDays.map((day) => (
                    <div key={day.date}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5 sticky top-0 bg-background py-1">
                        {day.date}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {day.slots.map((slot) => {
                          const isSelected = selectedSlots.includes(slot.iso);
                          return (
                            <button
                              key={slot.iso}
                              onClick={() => !slot.busy && toggleSlot(slot.iso)}
                              disabled={slot.busy}
                              className={`
                                px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border
                                ${
                                  slot.busy
                                    ? "bg-muted text-muted-foreground/50 border-transparent cursor-not-allowed line-through"
                                    : isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background hover:bg-accent border-border hover:border-primary/50"
                                }
                              `}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                onClick={handleGenerateRequest}
                disabled={generating || selectedSlots.length === 0}
                className="gap-1.5"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Generate Meeting Request ({selectedSlots.length} slot
                    {selectedSlots.length !== 1 ? "s" : ""})
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Review Email */}
        {step === "review" && outreach && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Subject
                </p>
                <p className="text-sm font-medium">{outreach.subject}</p>
              </div>
              <Separator />
              <div
                className="text-sm leading-relaxed prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: outreach.bodyHtml }}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                This email has been created as a draft in your outreach queue.
                You can review, edit, and send it from the{" "}
                <a href={`/outreach/${outreach.id}`} className="underline">
                  outreach review page
                </a>
                .
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">
                Confirm Meeting (after contact responds)
              </p>
              <p className="text-xs text-muted-foreground">
                Once the contact picks a time, enter it here to create a
                calendar event.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="confirmTime" className="text-xs">
                    Confirmed Date & Time
                  </Label>
                  <Input
                    id="confirmTime"
                    type="datetime-local"
                    value={confirmTime}
                    onChange={(e) => setConfirmTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duration" className="text-xs">
                    Duration (minutes)
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min={15}
                    max={120}
                    step={15}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleConfirmMeeting}
                disabled={confirming || !confirmTime}
                className="gap-1.5"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating Event...
                  </>
                ) : (
                  <>
                    <Calendar className="h-3.5 w-3.5" />
                    Create Calendar Event
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmed */}
        {step === "confirmed" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold">Meeting Scheduled</p>
              <p className="text-sm text-muted-foreground mt-1">
                A calendar event has been created and an invite sent to{" "}
                {contactName}.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
