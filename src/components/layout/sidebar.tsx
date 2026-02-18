"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Send,
  Globe,
  Settings,
  LogOut,
  Menu,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";

interface SidebarProps {
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  workspace: {
    name: string;
    slug: string;
  };
  role: string;
}

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    label: "Outreach Queue",
    href: "/outreach",
    icon: Send,
  },
  {
    label: "Domains",
    href: "/domains",
    icon: Globe,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SidebarContent({
  user,
  workspace,
  role,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Workspace header */}
      <div className="flex h-14 items-center gap-3 border-b border-border/50 px-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Zap className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">
            {workspace.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Outreach Engine
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-accent-foreground"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="md:hidden">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto border-t border-border/50">
        {/* Workspace switcher - only for OWNER */}
        {role === "OWNER" && (
          <div className="px-3 py-2">
            <WorkspaceSwitcher workspaceName={workspace.name} />
          </div>
        )}

        <Separator className="opacity-50" />

        {/* User profile + sign out */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar className="size-7">
            {user.image && <AvatarImage src={user.image} alt={user.name} />}
            <AvatarFallback className="text-[10px] font-medium">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="size-3.5" />
                <span className="sr-only">Sign out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar({ user, workspace, role }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-border/50 bg-background px-4 md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="size-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            

            className="w-[280px] p-0"
          >
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent
              user={user}
              workspace={workspace}
              role={role}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <div className="ml-3 flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <span className="text-sm font-semibold">{workspace.name}</span>
        </div>
      </div>

      {/* Mobile spacer to push content below the fixed top bar */}
      <div className="h-14 shrink-0 md:hidden" />

      {/* Desktop sidebar */}
      <aside className="hidden w-[240px] shrink-0 border-r border-border/50 bg-background md:flex md:flex-col">
        <SidebarContent
          user={user}
          workspace={workspace}
          role={role}
        />
      </aside>
    </>
  );
}
