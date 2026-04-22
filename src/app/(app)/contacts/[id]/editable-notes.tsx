"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil, Check, X, Loader2 } from "lucide-react";

interface EditableNotesProps {
  contactId: string;
  initialNotes: string | null;
}

export function EditableNotes({ contactId, initialNotes }: EditableNotesProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value || null }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Notes saved");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">Notes</p>
          {!editing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setValue(initialNotes || ""); setEditing(true); }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
        {editing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
                if (e.key === "Escape") { setValue(initialNotes || ""); setEditing(false); }
              }}
              className="w-full text-sm border rounded-md px-3 py-2 min-h-[80px] resize-y bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Add notes... (Cmd/Ctrl+Enter to save)"
            />
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={save} disabled={saving} className="h-7 px-2 text-xs">
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setValue(initialNotes || ""); setEditing(false); }} className="h-7 px-2 text-xs">
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">
            {initialNotes || <span className="text-muted-foreground italic">No notes</span>}
          </p>
        )}
      </div>
    </>
  );
}
