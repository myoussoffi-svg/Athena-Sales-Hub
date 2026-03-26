"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileText, Upload, Trash2, Loader2, ExternalLink } from "lucide-react";

interface ResumeUploadProps {
  contactId: string;
  resumeUrl: string | null;
  resumeName: string | null;
}

export function ResumeUpload({ contactId, resumeUrl, resumeName }: ResumeUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/contacts/${contactId}/resume`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      toast.success("Resume uploaded");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/resume`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Resume removed");
      router.refresh();
    } catch {
      toast.error("Failed to remove resume");
    } finally {
      setDeleting(false);
    }
  }

  if (resumeUrl) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-blue-500/15 flex items-center justify-center">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">Resume</p>
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            <span className="truncate">{resumeName || "Resume"}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          disabled={deleting}
          className="shrink-0 text-muted-foreground hover:text-red-600"
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Resume</p>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-sm font-medium"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading...
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Upload className="h-3 w-3" />
              Upload resume
            </span>
          )}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
