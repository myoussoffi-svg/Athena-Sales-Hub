import { requireWorkspace } from "@/lib/workspace";
import { prisma } from "@/lib/db";
import { VoiceTraining } from "./voice-training";
import { WorkspaceSettings } from "./workspace-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mic,
  Settings,
  User,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const { user, workspace, workspaceRole } = await requireWorkspace();

  // Load user data for account tab
  const fullUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      microsoftRefreshToken: true,
      tokenExpiry: true,
    },
  });

  // Load voice samples for voice training tab
  const voiceSamples = await prisma.voiceSample.findMany({
    where: { userId: user.id, workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  // Load workspace settings
  const workspaceData = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspace.id },
    select: {
      aiSystemPrompt: true,
      campaignTypes: true,
      settings: true,
    },
  });

  const settings = (workspaceData.settings as Record<string, unknown>) ?? {};
  const voiceProfile = (settings.voiceProfile as string) ?? "";
  const hasMicrosoftConnection = !!fullUser.microsoftRefreshToken;
  const tokenExpired =
    fullUser.tokenExpiry && fullUser.tokenExpiry < new Date();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your voice profile, workspace configuration, and account
        </p>
      </div>

      <Tabs defaultValue="voice">
        <TabsList>
          <TabsTrigger value="voice" className="gap-1.5">
            <Mic className="h-3.5 w-3.5" />
            Voice Training
          </TabsTrigger>
          {workspaceRole === "ADMIN" && (
            <TabsTrigger value="workspace" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Workspace
            </TabsTrigger>
          )}
          <TabsTrigger value="account" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Account
          </TabsTrigger>
        </TabsList>

        {/* Voice Training Tab */}
        <TabsContent value="voice">
          <VoiceTraining
            initialSamples={voiceSamples.map((s: { id: string; sampleText: string; createdAt: Date }) => ({
              id: s.id,
              sampleText: s.sampleText,
              createdAt: s.createdAt.toISOString(),
            }))}
            currentVoiceProfile={voiceProfile}
          />
        </TabsContent>

        {/* Workspace Settings Tab */}
        {workspaceRole === "ADMIN" && (
          <TabsContent value="workspace">
            <WorkspaceSettings
              initialPrompt={workspaceData.aiSystemPrompt}
              initialCampaignTypes={
                (workspaceData.campaignTypes as string[]) ?? []
              }
              initialSettings={settings}
            />
          </TabsContent>
        )}

        {/* Account Tab */}
        <TabsContent value="account">
          <div className="space-y-6 max-w-2xl">
            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-medium">
                      {fullUser.name ?? "Not set"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{fullUser.email}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Workspace Role
                  </p>
                  <Badge variant="secondary">{workspaceRole}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Microsoft Connection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Microsoft Connection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  {hasMicrosoftConnection && !tokenExpired ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Connected</p>
                        <p className="text-xs text-muted-foreground">
                          Token expires{" "}
                          {fullUser.tokenExpiry
                            ? new Date(
                                fullUser.tokenExpiry,
                              ).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "unknown"}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                      <div>
                        <p className="text-sm font-medium">
                          {hasMicrosoftConnection
                            ? "Token Expired"
                            : "Not Connected"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {hasMicrosoftConnection
                            ? "Your Microsoft session has expired. Reconnect to resume email and calendar access."
                            : "Connect your Microsoft account for email sending and calendar access."}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <Link href="/api/auth/signin">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {hasMicrosoftConnection
                      ? "Reconnect Microsoft"
                      : "Connect Microsoft"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
