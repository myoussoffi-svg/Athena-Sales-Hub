import { auth, signOut } from "@/lib/auth";
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

  // If user has no workspaces, show helpful message with email + sign out
  if (workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-2xl font-bold">No Workspaces</h1>
          <p className="text-muted-foreground">
            You don&apos;t have access to any workspaces yet. Ask your admin to
            invite this email:
          </p>
          <p className="font-mono text-sm bg-muted px-3 py-2 rounded-md">
            {session.user.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Once invited, sign out and sign back in to get access.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <WorkspaceSelector workspaces={workspaces} />;
}
