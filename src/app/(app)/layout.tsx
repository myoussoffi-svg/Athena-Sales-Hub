import { requireWorkspace } from "@/lib/workspace";
import { AppSidebar } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace, workspaceRole } = await requireWorkspace();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        user={{
          name: user.name ?? "User",
          email: user.email ?? "",
          image: user.image ?? null,
        }}
        workspace={{
          name: workspace.name,
          slug: workspace.slug,
        }}
        role={workspaceRole}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
