// ─── School Org Standard Template ────────────────────────────────────
// Used for finance_club, faculty_career_services, and student_direct campaigns.
// This is the standard Athena outreach email with 3 body paragraphs.

export const SCHOOL_ORG_CAMPAIGN_TYPES = [
  "finance_club",
  "faculty_career_services",
  "student_direct",
];

export function isSchoolOrgCampaign(campaignType: string): boolean {
  return SCHOOL_ORG_CAMPAIGN_TYPES.includes(campaignType);
}

export const SCHOOL_ORG_TEMPLATE_SUBJECT_PREFIX = "Athena";

export const SCHOOL_ORG_TEMPLATE_PLAIN = `Hi,

I'm reaching out with a new platform that we put together, Athena, a training and recruiting platform aimed at helping students find roles in banking and PE. Athena is an online IB/PE career platform, led by ex-banking and PE professionals, that covers the full technical foundation (modeling, valuation, LBOs, M&A), but is designed around getting hired. The platform gives students real reps with applications of technical skills and includes realistic interview simulations, a resume feedback portal, and an AI-supported outreach CRM that helps students generate and send bulk emails to finance contacts.

We are currently finalizing a selective program that pairs top Athena performers with experienced mentors and boutique investment banking internship opportunities. We're starting by sharing Athena with student organizations as an added resource for motivated members recruiting for IB, M&A and private equity roles. I am including a demo for you to see if you would like to take a look: https://learn.athena.pe/preview/ib

Would this be of interest to any students in your program? If so, we might also be able to provide discounts if multiple members are interested.

Best,
Montana
ATHENA
Montana Youssoffi
Co-Founder
Montana@athena.pe`;

export const SCHOOL_ORG_TEMPLATE_HTML = `<p>Hi,</p>
<p>I'm reaching out with a new platform that we put together, Athena, a training and recruiting platform aimed at helping students find roles in banking and PE. Athena is an online IB/PE career platform, led by ex-banking and PE professionals, that covers the full technical foundation (modeling, valuation, LBOs, M&amp;A), but is designed around getting hired. The platform gives students real reps with applications of technical skills and includes realistic interview simulations, a resume feedback portal, and an AI-supported outreach CRM that helps students generate and send bulk emails to finance contacts.</p>
<p>We are currently finalizing a selective program that pairs top Athena performers with experienced mentors and boutique investment banking internship opportunities. We're starting by sharing Athena with student organizations as an added resource for motivated members recruiting for IB, M&amp;A and private equity roles. I am including a demo for you to see if you would like to take a look: <a href="https://learn.athena.pe/preview/ib">https://learn.athena.pe/preview/ib</a></p>
<p>Would this be of interest to any students in your program? If so, we might also be able to provide discounts if multiple members are interested.</p>
<p>Best,<br>Montana<br>ATHENA<br>Montana Youssoffi<br>Co-Founder<br>Montana@athena.pe</p>`;
