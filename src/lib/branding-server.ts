import { headers } from "next/headers";
import { brandForHost, type Brand } from "@/lib/branding";

/**
 * Brand for the current request, resolved from the Host header.
 * Use in Server Components / layouts / generateMetadata only — importing
 * this from a Client Component fails the build ("next/headers" is
 * server-only). Pure branding helpers (isRecruitingWorkspace,
 * brandForWorkspaceSlug, etc.) stay in branding.ts so client components
 * can import those safely.
 */
export async function getRequestBrand(): Promise<Brand> {
  const h = await headers();
  return brandForHost(h.get("host"));
}
