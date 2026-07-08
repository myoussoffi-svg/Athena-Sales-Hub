# Outreach Engine — Build Progress

## Step 1: Scaffold + Database + Auth + Workspaces
- [x] Initialize Next.js project with TypeScript, Tailwind, App Router
- [x] Install all dependencies (Prisma, NextAuth, shadcn, Claude SDK, Graph client, etc.)
- [x] Set up shadcn/ui with 18 components
- [x] Configure port 3001
- [x] Create .env.example and .env.local
- [x] Create CLAUDE.md with working practices
- [x] Prisma schema (10 models: Workspace, User, Account, Session, VerificationToken, WorkspaceMember, SendingDomain, Campaign, Contact, Outreach, VoiceSample, WarmupLog, JobQueue)
- [x] Prisma v7 + PG adapter setup
- [x] Encryption utility (AES-256-GCM)
- [x] NextAuth.js v5 with Azure AD (Microsoft Entra ID)
- [x] Workspace middleware + route protection
- [x] Login page with Microsoft sign-in
- [x] Workspace selector (multi-workspace for owner)
- [x] Seed script (Athena + Alta with full AI system prompts)

## Step 2: Outlook Integration + Sending Infrastructure
- [x] Microsoft Graph wrapper (outlook.ts) — createDraft, sendDraft, sendEmail, getRecentReplies, getCalendarAvailability, createCalendarEvent
- [x] Graph API resilience — 429 retry, exponential backoff, token refresh
- [x] SMTP sender (smtp.ts) — for warmup domains
- [x] Database-backed send queue (send-queue.ts) — domain rotation, daily limits, send window, retry
- [x] Job processor (job-processor.ts) — node-cron scheduler for send queue, reply detection, follow-ups, warmup

## Step 3: Domain Warmup System
- [x] Warmup agent (warmup-agent.ts) — 4-week ramp, cross-domain warmup, health scoring
- [x] DNS health checker (SPF/DKIM/DMARC via DNS lookup)
- [x] Domain management API (CRUD + actions)
- [x] Domain management UI — cards with status, DNS indicators, health score, warmup progress
- [x] Add domain dialog
- [x] Domain action buttons (start/pause/resume warmup, check DNS)

## Step 4: AI Engine
- [x] Claude tool_use email generation (claude.ts) — structured output, 3 subject variants, hook scoring
- [x] Reply sentiment classification + suggested reply drafts
- [x] Research agent (research-agent.ts) — website scraping with cheerio
- [x] Voice matching (voice-matching.ts) — style analysis from sample emails
- [x] Athena system prompt (baked into seed)
- [x] Alta system prompt (baked into seed)

## Step 5: App Layout + Core UI
- [x] Sidebar navigation (desktop + mobile responsive)
- [x] Workspace switcher (owner only)
- [x] App layout with workspace scoping
- [x] Protected routes via middleware
- [x] Dark theme with next-themes

## Step 6: Campaigns + Contacts
- [x] Campaign CRUD API
- [x] Campaign list page with cards
- [x] New campaign dialog
- [x] Campaign detail page with contacts table + status controls
- [x] Contact CRUD API
- [x] Contact list page with search + filters
- [x] CSV upload dialog with preview
- [x] Add contact dialog
- [x] Contact detail page with info, research, outreach timeline
- [x] Research button + API integration
- [x] Contact status select dropdown

## Step 7: Core Outreach Loop
- [x] Batch email generation API (per campaign)
- [x] Generate dialog (campaign selector, progress)
- [x] Outreach queue page (list drafts pending review)
- [x] Review page — THE MOAT:
  - [x] Two-column layout (email + context)
  - [x] Subject line variant picker (3 options as chips)
  - [x] Email preview (light theme, real email styling)
  - [x] Inline HTML editor with live preview
  - [x] Personalization hook badge + score indicator
  - [x] Approve & Send, Edit, Regenerate, Skip actions
  - [x] Keyboard shortcuts (A, E, R, S, arrows)
  - [x] Progress indicator + auto-navigation
  - [x] Regenerate dialog with custom instructions + quick suggestions

## Step 8: Reply Detection + Follow-ups
- [x] Reply detection via cron (every 15 min, checks Graph API)
- [x] Reply sentiment classification (interested/maybe_later/not_interested/ooo/wrong_person)
- [x] Suggested reply draft generation
- [x] Follow-up scheduling (automatic FOLLOWUP_1 + FOLLOWUP_2 on initial send)
- [x] Follow-up generation via cron (daily, generates AI emails for due follow-ups)
- [x] Auto-cancel follow-ups when contact replies

## Step 9: Meeting Scheduling
- [x] Calendar availability API (reads Outlook calendar)
- [x] Meeting dialog with time slot picker
- [x] AI meeting request email generation
- [x] Calendar event creation on confirmation
- [x] Contact status update to MEETING_SCHEDULED

## Step 10: Dashboard + Settings
- [x] Dashboard with stats cards (contacts, emails sent, pending, replies)
- [x] Settings page with 3 tabs:
  - [x] Voice Training (add samples, generate profile)
  - [x] Workspace Settings (AI prompt, campaign types, defaults)
  - [x] Account (user info, Microsoft connection status)

## Build Verification
- [x] TypeScript compiles with zero errors
- [x] Next.js production build succeeds (all 30+ routes)
- [ ] Dev server runs on localhost:3001 (needs DATABASE_URL)
- [ ] End-to-end test with real Outlook account

## Workstream B — Seller Outreach (in progress, 2026-07-07)
- [x] Alta voice calibrated: acquisition-only, direct ask, no em dashes, Montana/Sourcealta.com sig (prisma/prompts.ts)
- [x] One-click "Prepare Drafts" (bulk research + generate) on campaign page
- [x] CSV upload fix (websiteUrl/orgType were dropped) + Owner/Company aliases
- [x] Chunked + resumable Prepare Drafts (survives Vercel timeouts on 100+ contacts)
- [ ] Click-verify the full flow in browser (upload -> prepare -> review -> send)
- [ ] Sending infra: per-user personal-inbox daily soft-ramp (~5-10/day)
- [ ] Warmed sending domains (buy + mailboxes + DNS + warmup) to protect primary sourcealta.com
- [ ] Per-campaign sendMode (Review/Auto) + senderType (PERSONAL/POOL)

## Buyer Outreach (QUEUED — build after seller outreach)
- Separate "Buyer Outreach" section: pitch Alta's retained buyside sourcing to PE firms + new portfolio cos
- Source: buyoutdesk.com (friend's PE deal tracker) — rank high-velocity platforms by add-on count
- Phase 0 blocker: get buyoutdesk API/export from friend (email enrichment is OUT — user finds emails via Apollo himself)
- Deliverable per target: contact (name/title/firm) + fully-written email; user pastes email into editable "To" field + Approve/Send
- Build as a SECTION in the Alta workspace (kind flag on Campaign/Contact, allow email-less buyer contacts) + buyer system prompt; reuse generate/review/send
- New: Deal table, ingestion + velocity ranking, press-release contact extraction (name/title/firm only), editable recipient in review UI (send blocked until email set), buyer prompt, deals dashboard
- See memory: project_alta_buyer_outreach.md
