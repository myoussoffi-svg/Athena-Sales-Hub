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
import { Badge } from "@/components/ui/badge";
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
import { Loader2, UserPlus, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    role: string;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: { name: string | null; email: string };
}

interface TeamManagementProps {
  initialMembers: Member[];
  initialInvitations: Invitation[];
}

export function TeamManagement({
  initialMembers,
  initialInvitations,
}: TeamManagementProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<Invitation[]>(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    try {
      const res = await fetch("/api/workspace/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to invite");
        return;
      }

      if (data.type === "member_added") {
        setMembers((prev) => [...prev, data.member]);
        toast.success("Member added directly (they already have an account)");
      } else {
        setInvitations((prev) => [data.invitation, ...prev]);
        toast.success("Invitation created — they'll get access when they sign in");
      }
      setEmail("");
      setRole("MEMBER");
    } catch {
      toast.error("Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    setLoadingId(memberId);
    try {
      const res = await fetch(`/api/workspace/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to update role");
        return;
      }

      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole, user: data.user } : m)),
      );
      toast.success("Role updated");
    } catch {
      toast.error("Failed to update role");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(id: string, type: "member" | "invitation") {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/workspace/members/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to remove");
        return;
      }

      if (type === "member") {
        setMembers((prev) => prev.filter((m) => m.id !== id));
        toast.success("Member removed");
      } else {
        setInvitations((prev) => prev.filter((i) => i.id !== id));
        toast.success("Invitation cancelled");
      }
    } catch {
      toast.error("Failed to remove");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite Team Member</CardTitle>
          <CardDescription>
            Add a colleague by email. If they already have an account they&apos;ll
            be added immediately, otherwise they&apos;ll get access when they sign
            in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="colleague@athena.pe"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Member</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={inviting} className="gap-1.5">
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Invite
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">
                        {m.user.name ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.user.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.user.role === "OWNER" ? (
                      <Badge>Owner</Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onValueChange={(v) => handleRoleChange(m.id, v)}
                        disabled={loadingId === m.id}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    {m.user.role !== "OWNER" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemove(m.id, "member")}
                        disabled={loadingId === m.id}
                      >
                        {loadingId === m.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pending Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{inv.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{inv.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {inv.invitedBy.name ?? inv.invitedBy.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleRemove(inv.id, "invitation")}
                        disabled={loadingId === inv.id}
                      >
                        {loadingId === inv.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
