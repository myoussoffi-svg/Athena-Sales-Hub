import { auth } from "@/lib/auth";
import { getUserWorkspaces } from "@/lib/workspace";
import { redirect } from "next/navigation";
import { WorkspaceSelector } from "./workspace-selector";

export default async function SelectWorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspaces = await getUserWorkspaces(session.user.id);

  // If user has only one workspace, auto-select it
  if (workspaces.length === 1) {
    redirect(`/api/workspace/set?id=${workspaces[0].id}`);
  }

  // If user has no workspaces, show an error
  if (workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">No Workspaces</h1>
          <p className="text-muted-foreground mt-2">
            You don&apos;t have access to any workspaces yet. Contact the admin.
          </p>
        </div>
      </div>
    );
  }

  return <WorkspaceSelector workspaces={workspaces} />;
}
