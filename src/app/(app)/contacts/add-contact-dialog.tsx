"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Plus, FileText, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Campaign {
  id: string;
  name: string;
}

interface AddContactDialogProps {
  campaigns: Campaign[];
}

export function AddContactDialog({ campaigns }: AddContactDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [organization, setOrganization] = useState("");
  const [orgType, setOrgType] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [isAthenaMentor, setIsAthenaMentor] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          title: title.trim() || undefined,
          organization: organization.trim() || undefined,
          orgType: orgType.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          isAthenaMentor,
          campaignId: campaignId && campaignId !== "none" ? campaignId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create contact");
      }

      const contact = await res.json();

      // Upload resume if one was selected
      if (resumeFile) {
        const formData = new FormData();
        formData.append("file", resumeFile);
        const uploadRes = await fetch(`/api/contacts/${contact.id}/resume`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          let message = "Contact created but resume upload failed";
          try {
            const data = await uploadRes.json();
            message = data.error ? `Contact created but: ${data.error}` : message;
          } catch {
            // Response may not be JSON
          }
          toast.error(message);
        }
      }

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (err) {
      console.error("Failed to create contact:", err);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setTitle("");
    setOrganization("");
    setOrgType("");
    setLocation("");
    setNotes("");
    setWebsiteUrl("");
    setLinkedinUrl("");
    setIsAthenaMentor(false);
    setCampaignId("");
    setResumeFile(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>
              Manually add a new contact to your workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-name">Name *</Label>
                <Input
                  id="contact-name"
                  placeholder="John Smith"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-email">Email *</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-title">Title</Label>
                <Input
                  id="contact-title"
                  placeholder="VP of Operations"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-org">Organization</Label>
                <Input
                  id="contact-org"
                  placeholder="Acme Corp"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-orgtype">Organization Type</Label>
                <Input
                  id="contact-orgtype"
                  placeholder="e.g., Bank, Insurance"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-location">Location</Label>
                <Input
                  id="contact-location"
                  placeholder="Dallas, TX"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
                <Input
                  id="contact-linkedin"
                  placeholder="https://linkedin.com/in/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-website">Website URL</Label>
                <Input
                  id="contact-website"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="contact-mentor"
                checked={isAthenaMentor}
                onCheckedChange={(checked) => setIsAthenaMentor(checked === true)}
              />
              <Label htmlFor="contact-mentor" className="text-sm font-normal">
                Athena Mentor
              </Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact-campaign">Campaign (optional)</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger id="contact-campaign">
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

            <div className="grid gap-2">
              <Label>Resume (optional)</Label>
              {resumeFile ? (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <FileText className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm truncate flex-1">{resumeFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setResumeFile(null)}
                    className="p-0.5 rounded hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start text-muted-foreground font-normal"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose PDF or Word document
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setResumeFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                placeholder="Any relevant notes about this contact..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
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
            <Button
              type="submit"
              disabled={loading || !name.trim() || !email.trim()}
            >
              {loading ? "Creating..." : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
