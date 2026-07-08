"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

export function SignInButton() {
  return (
    <Button
      onClick={() =>
        signIn("microsoft-entra-id", { callbackUrl: "/select-workspace" })
      }
      className="w-full h-12 text-base"
      size="lg"
    >
      <Mail className="mr-2 h-5 w-5" />
      Sign in with Microsoft
    </Button>
  );
}
