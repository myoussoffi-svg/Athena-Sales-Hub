"use client";

import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export function WorkspaceSelector({
  workspaces,
}: {
  workspaces: Workspace[];
}) {
  const router = useRouter();

  const selectWorkspace = async (workspaceId: string) => {
    await fetch(`/api/workspace/set?id=${workspaceId}`, { method: "POST" });
    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            Select Workspace
          </CardTitle>
          <CardDescription>
            Choose which business to work in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {workspaces.map((ws) => (
            <Button
              key={ws.id}
              variant="outline"
              className="w-full h-16 justify-start text-left"
              onClick={() => selectWorkspace(ws.id)}
            >
              <Building2 className="mr-3 h-6 w-6 text-muted-foreground" />
              <div>
                <div className="font-semibold">{ws.name}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {ws.role.toLowerCase()}
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
