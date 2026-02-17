# Outreach Engine — Project Guide

## What This Is
Multi-workspace AI outreach engine for Athena Recruiting (athena.pe) and Source Alta (altapartner.com).
Core loop: Upload targets -> AI researches -> Generate personalized emails -> Human reviews -> Send via rotated warmed domains -> Detect replies -> Auto follow-ups -> Close with meeting.

## Tech Stack
- Next.js 14+ (App Router) on port 3001
- PostgreSQL (Neon) + Prisma ORM
- NextAuth.js v5 with Azure AD
- Tailwind CSS + shadcn/ui
- Claude API (tool_use mode) for email generation
- Microsoft Graph API + SMTP for sending
- node-cron for background jobs (NOT Inngest — conflicts with other project)
- Cheerio for web scraping

## Key Architecture Decisions
- **Multi-workspace**: Athena and Alta are strictly isolated. Only owner sees both.
- **No Inngest**: Database-backed job queue + node-cron instead. Self-contained.
- **No SQLite**: PostgreSQL from day one via Neon.
- **Token security**: Only encrypted refresh tokens stored. Access tokens derived on demand.
- **Domain rotation**: Emails sent via rotated warmed domains, not a single inbox.
- **Claude tool_use**: Structured output via tool calls, not fragile JSON parsing.

## Working Practices

### Workflow Orchestration
1. **Plan Mode Default**: Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions). If something goes sideways, STOP and re-plan immediately. Write detailed specs upfront.
2. **Subagent Strategy**: Offload research, exploration, and parallel analysis to subagents. One task per subagent for focused execution.
3. **Self-Improvement Loop**: After ANY correction from the user, update `tasks/lessons.md` with the pattern. Write rules that prevent the same mistake.
4. **Verification Before Done**: Never mark a task complete without proving it works. Ask: "Would a staff engineer approve this?" Run tests, check logs, demonstrate correctness.
5. **Demand Elegance (Balanced)**: For non-trivial changes, pause and ask "is there a more elegant way?" Skip for simple obvious fixes.
6. **Autonomous Bug Fixing**: When given a bug report, just fix it. Don't ask for hand-holding. Zero context switching for the user.

### Task Management
1. Write plan to `tasks/todo.md` with checkable items
2. Check in before starting implementation
3. Mark items complete as you go
4. High-level summary at each step
5. Document results in `tasks/todo.md`
6. Update `tasks/lessons.md` after corrections

### Core Principles
- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
