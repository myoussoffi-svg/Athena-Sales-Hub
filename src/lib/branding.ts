/**
 * Per-domain / per-workspace branding.
 *
 * The app serves two brands from one codebase:
 *  - Athena Recruiting (default) on the original Vercel URL / athena domains
 *  - Source Alta (buyside sourcing) on outreachapp.sourcealta.com
 *
 * Chrome (logo, login, page title) is resolved by HOST so Alta colleagues
 * never see Athena on the Alta domain — even on the pre-login screen.
 * Feature vocabulary (recruiting-only statuses, mentor/student flags) is
 * gated separately by workspace slug — see `isRecruitingWorkspace`.
 */

export type BrandKey = "athena" | "alta";

export interface Brand {
  key: BrandKey;
  /** Letter-spaced wordmark shown in the sidebar / top bar. */
  wordmark: string;
  /** Human-facing product name. */
  name: string;
  /** Login screen heading. */
  loginTitle: string;
  /** Login screen subtitle. */
  loginTagline: string;
  /** Browser tab title. */
  pageTitle: string;
  /** Tab meta description. */
  pageDescription: string;
}

const ATHENA: Brand = {
  key: "athena",
  wordmark: "ATHENA",
  name: "Athena",
  loginTitle: "Outreach Engine",
  loginTagline: "AI-powered sales outreach platform",
  pageTitle: "Outreach Engine",
  pageDescription: "AI-powered outreach platform",
};

const ALTA: Brand = {
  key: "alta",
  wordmark: "ALTA",
  name: "Alta",
  loginTitle: "Alta",
  loginTagline: "Buyside sourcing outreach",
  pageTitle: "Alta",
  pageDescription: "Buyside sourcing outreach platform",
};

const BRANDS: Record<BrandKey, Brand> = { athena: ATHENA, alta: ALTA };

/** The host that serves the Alta brand. */
const ALTA_HOST_MATCH = "sourcealta.com";

/** Resolve a brand from a request hostname. Alta domain => Alta; else Athena. */
export function brandForHost(host?: string | null): Brand {
  if (host && host.toLowerCase().includes(ALTA_HOST_MATCH)) return ALTA;
  return ATHENA;
}

/** Resolve a brand from a workspace slug (fallback when host isn't decisive). */
export function brandForWorkspaceSlug(slug?: string | null): Brand {
  return slug === "alta" ? ALTA : ATHENA;
}

export function getBrand(key: BrandKey): Brand {
  return BRANDS[key];
}

/**
 * Whether a workspace exposes recruiting-specific features (mentor/student
 * flags, hire statuses). True only for Athena; Alta is buyside sourcing and
 * must show no recruiting concepts.
 */
export function isRecruitingWorkspace(slug?: string | null): boolean {
  return slug !== "alta";
}
