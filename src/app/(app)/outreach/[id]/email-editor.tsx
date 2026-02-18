"use client";

import { useState, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Pencil, Eye, Save, Loader2 } from "lucide-react";

interface EmailEditorProps {
  outreachId: string;
  initialSubject: string;
  initialBodyHtml: string;
  subjectVariants: string[];
}

export function EmailEditor({
  outreachId,
  initialSubject,
  initialBodyHtml,
  subjectVariants,
}: EmailEditorProps) {
  const [activeSubject, setActiveSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [editSubject, setEditSubject] = useState(initialSubject);
  const [editBodyHtml, setEditBodyHtml] = useState(initialBodyHtml);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubjectVariantClick = useCallback(
    async (variant: string) => {
      setActiveSubject(variant);
      setEditSubject(variant);

      // Persist the subject change
      try {
        const res = await fetch(`/api/outreach/${outreachId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: variant }),
        });
        if (!res.ok) throw new Error("Failed to update subject");
      } catch {
        toast.error("Failed to save subject change");
      }
    },
    [outreachId],
  );

  const toggleEdit = useCallback(() => {
    if (isEditing) {
      // Cancel edit: revert to saved state
      setEditSubject(activeSubject);
      setEditBodyHtml(bodyHtml);
    }
    setIsEditing(!isEditing);
  }, [isEditing, activeSubject, bodyHtml]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // Strip HTML to create plain text
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = editBodyHtml;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";

      const res = await fetch(`/api/outreach/${outreachId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          bodyHtml: editBodyHtml,
          bodyPlain: plainText,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setActiveSubject(editSubject);
      setBodyHtml(editBodyHtml);
      setIsEditing(false);
      toast.success("Email saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [outreachId, editSubject, editBodyHtml]);

  // Convert plain text to HTML for preview (matches server-side conversion)
  const previewHtml = useMemo(() => {
    const html = isEditing ? editBodyHtml : bodyHtml;
    if (!html || /<[a-z][\s\S]*>/i.test(html)) return html;
    return html
      .split(/\n{2,}/)
      .map((p: string) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }, [isEditing, editBodyHtml, bodyHtml]);

  // Expose toggle for keyboard shortcut
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__emailEditorToggle =
      toggleEdit;
  }

  return (
    <div className="space-y-3">
      {/* Subject variant chips */}
      <div className="flex flex-wrap gap-2">
        {subjectVariants.map((variant, i) => (
          <button
            key={i}
            onClick={() => handleSubjectVariantClick(variant)}
            className={`
              text-sm px-3 py-1.5 rounded-full border transition-all cursor-pointer
              ${
                activeSubject === variant
                  ? "border-primary bg-primary/10 text-primary font-medium shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }
            `}
          >
            <span className="text-xs text-muted-foreground mr-1.5">
              {i + 1}.
            </span>
            {variant}
          </button>
        ))}
      </div>

      {/* Edit mode toggle + save */}
      <div className="flex items-center justify-end gap-2">
        {isEditing && (
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={toggleEdit}>
          {isEditing ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </>
          )}
        </Button>
      </div>

      {isEditing ? (
        /* ── Edit Mode ── */
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Subject
            </label>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              className="font-medium"
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* HTML editor */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                HTML Source
              </label>
              <Textarea
                value={editBodyHtml}
                onChange={(e) => setEditBodyHtml(e.target.value)}
                className="min-h-[400px] font-mono text-xs leading-relaxed"
              />
            </div>
            {/* Live preview */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Live Preview
              </label>
              <div className="rounded-lg border bg-white text-black min-h-[400px] overflow-y-auto">
                <div className="px-6 py-5">
                  <div
                    className="email-preview-content prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Preview Mode: Email rendered like a real client ── */
        <div className="rounded-xl border bg-white dark:bg-white shadow-sm overflow-hidden">
          {/* Email header bar */}
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
              <span className="font-medium text-gray-500">Subject:</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
              {activeSubject}
            </h2>
          </div>
          {/* Email body */}
          <div className="px-6 py-5">
            <div
              className="email-preview-content"
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: "14px",
                lineHeight: "1.65",
                color: "#1a1a1a",
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}

      {/* Inline styles for email preview content */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .email-preview-content p {
          margin: 0 0 1em 0;
          color: #1a1a1a;
        }
        .email-preview-content p:last-child {
          margin-bottom: 0;
        }
        .email-preview-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .email-preview-content ul, .email-preview-content ol {
          margin: 0 0 12px 0;
          padding-left: 20px;
        }
        .email-preview-content li {
          margin-bottom: 4px;
          color: #1a1a1a;
        }
        .email-preview-content strong, .email-preview-content b {
          font-weight: 600;
        }
      `,
        }}
      />
    </div>
  );
}
