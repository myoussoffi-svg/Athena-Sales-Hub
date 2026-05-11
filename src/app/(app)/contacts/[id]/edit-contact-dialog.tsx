"use client";

import { useState } from "react";
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
import { Pencil, Loader2 } from "lucide-react";

interface EditContactDialogProps {
  contactId: string;
  initial: {
    name: string;
    email: string;
    title: string | null;
    organization: string | null;
    orgType: string | null;
    location: string | null;
    linkedinUrl: string | null;
    websiteUrl: string | null;
  };
}

export function EditContactDialog({ contactId, initial }: EditContactDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [title, setTitle] = useState(initial.title ?? "");
  const [organization, setOrganization] = useState(initial.organization ?? "");
  const [orgType, setOrgType] = useState(initial.orgType ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [linkedinUrl, setLinkedinUrl] = useState(initial.linkedinUrl ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(initial.websiteUrl ?? "");

  function reset() {
    setName(initial.name);
    setEmail(initial.email);
    setTitle(initial.title ?? "");
    setOrganization(initial.organization ?? "");
    setOrgType(initial.orgType ?? "");
    setLocation(initial.location ?? "");
    setLinkedinUrl(initial.linkedinUrl ?? "");
    setWebsiteUrl(initial.websiteUrl ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          title: title.trim() || null,
          organization: organization.trim() || null,
          orgType: orgType.trim() || null,
          location: location.trim() || null,
          linkedinUrl: linkedinUrl.trim() || null,
          websiteUrl: websiteUrl.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update contact");
      }

      toast.success("Contact updated");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update this contact&apos;s information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-name">Name *</Label>
                <Input
                  id="edit-contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-email">Email *</Label>
                <Input
                  id="edit-contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-title">Title</Label>
                <Input
                  id="edit-contact-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-org">Organization</Label>
                <Input
                  id="edit-contact-org"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-orgtype">Organization Type</Label>
                <Input
                  id="edit-contact-orgtype"
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-location">Location</Label>
                <Input
                  id="edit-contact-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-linkedin">LinkedIn URL</Label>
                <Input
                  id="edit-contact-linkedin"
                  placeholder="https://linkedin.com/in/..."
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-contact-website">Website URL</Label>
                <Input
                  id="edit-contact-website"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                />
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
            <Button
              type="submit"
              disabled={saving || !name.trim() || !email.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
