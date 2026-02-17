"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">
            Outreach Engine
          </CardTitle>
          <CardDescription className="text-base">
            AI-powered sales outreach platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/select-workspace" })}
            className="w-full h-12 text-base"
            size="lg"
          >
            <Mail className="mr-2 h-5 w-5" />
            Sign in with Microsoft
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Sign in with your Microsoft account to connect Outlook
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
