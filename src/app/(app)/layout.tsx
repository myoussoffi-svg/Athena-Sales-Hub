import { headers } from "next/headers";
import { requireWorkspace } from "@/lib/workspace";
import { AppSidebar } from "@/components/layout/sidebar";
import { brandForHost, brandForWorkspaceSlug } from "@/lib/branding";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace, workspaceRole } = await requireWorkspace();

  // Chrome branding is host-primary (the Alta domain always reads as Alta,
  // even pre-login); on the neutral/Athena domain fall back to the active
  // workspace so an owner who switched to Alta still sees Alta branding.
  const hostBrand = brandForHost((await headers()).get("host"));
  const brand =
    hostBrand.key === "alta" ? hostBrand : brandForWorkspaceSlug(workspace.slug);

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
        brandWordmark={brand.wordmark}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="h-full">{children}</div>
      </main>
    </div>
  );
}
