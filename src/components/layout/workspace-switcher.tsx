"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WorkspaceSwitcherProps {
  workspaceName: string;
}

export function WorkspaceSwitcher({ workspaceName }: WorkspaceSwitcherProps) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.push("/select-workspace")}
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftRight className="size-3.5" />
      <span className="truncate text-xs">Switch Workspace</span>
    </Button>
  );
}
