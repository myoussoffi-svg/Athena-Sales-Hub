import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, Users, MessageSquare, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const { user, workspace } = await requireWorkspace();

  const [contactCount, outreachSent, outreachPending, repliedCount] =
    await Promise.all([
      prisma.contact.count({ where: { workspaceId: workspace.id } }),
      prisma.outreach.count({
        where: {
          userId: user.id,
          status: "SENT",
          campaign: { workspaceId: workspace.id },
        },
      }),
      prisma.outreach.count({
        where: {
          userId: user.id,
          status: { in: ["DRAFT_CREATED", "APPROVED"] },
          campaign: { workspaceId: workspace.id },
        },
      }),
      prisma.contact.count({
        where: { workspaceId: workspace.id, status: "REPLIED" },
      }),
    ]);

  const stats = [
    {
      title: "Total Contacts",
      value: contactCount,
      icon: Users,
      description: "In this workspace",
    },
    {
      title: "Emails Sent",
      value: outreachSent,
      icon: Mail,
      description: "By you",
    },
    {
      title: "Pending Review",
      value: outreachPending,
      icon: MessageSquare,
      description: "Drafts awaiting approval",
    },
    {
      title: "Replies",
      value: repliedCount,
      icon: Calendar,
      description: "Contacts who responded",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s your {workspace.name} overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription>{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
