"use client";

import { useState, useRef } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileUp, CheckCircle } from "lucide-react";
import Papa from "papaparse";

interface Campaign {
  id: string;
  name: string;
}

interface UploadDialogProps {
  campaigns: Campaign[];
}

interface ParsedRow {
  name?: string;
  email?: string;
  title?: string;
  organization?: string;
  orgType?: string;
  location?: string;
  notes?: string;
  websiteUrl?: string;
  [key: string]: string | undefined;
}

export function UploadDialog({ campaigns }: UploadDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    created: number;
    total: number;
    skipped: number;
  } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setResult(null);
    setError(null);

    // Parse preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target?.result as string;
      const text = raw.replace(/^\uFEFF/, "");
      const parsed = Papa.parse<ParsedRow>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
        transformHeader: (header: string) => header.trim().toLowerCase(),
      });

      if (parsed.meta.fields) {
        setHeaders(parsed.meta.fields);
      }
      setPreview(parsed.data);
    };
    reader.readAsText(selected);
  }

  async function handleUpload() {
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (campaignId && campaignId !== "none") {
        formData.append("campaignId", campaignId);
      }

      const res = await fetch("/api/contacts/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setResult(data);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function resetState() {
    setFile(null);
    setPreview([]);
    setHeaders([]);
    setCampaignId("");
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: name, email, title, organization,
            orgType, location, notes, websiteUrl
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">Upload Complete</h3>
            <p className="text-sm text-muted-foreground">
              Created {result.created} of {result.total} contacts.
              {result.skipped > 0 && ` ${result.skipped} rows skipped (missing name/email).`}
            </p>
            <Button onClick={() => setOpen(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="csv-file">CSV File</Label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    id="csv-file"
                    type="file"
                    accept=".csv,.xlsx"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Assign to Campaign (optional)</Label>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign</SelectItem>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {preview.length > 0 && (
                <div className="grid gap-2">
                  <Label>Preview (first {preview.length} rows)</Label>
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {headers.slice(0, 6).map((h) => (
                            <TableHead key={h} className="text-xs">
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row, i) => (
                          <TableRow key={i}>
                            {headers.slice(0, 6).map((h) => (
                              <TableCell
                                key={h}
                                className="text-xs truncate max-w-[150px]"
                              >
                                {row[h] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={loading || !file}
              >
                <FileUp className="h-4 w-4 mr-2" />
                {loading ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
