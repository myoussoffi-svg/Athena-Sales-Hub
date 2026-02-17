# Lessons Learned

## Session 1 — Initial Build
- Port 3000 occupied by other project — use 3001
- Don't use Inngest — conflicts with other project, use node-cron + DB queue instead
- Don't use SQLite — start with PostgreSQL (Neon) to avoid migration pain
- shadcn/ui toast is deprecated — use sonner instead
- Prisma v7 uses `prisma-client` generator (not `prisma-client-js`), generates `client.ts` not `index.ts` — import from `@/generated/prisma/client`
- Prisma v7 does NOT support `url` in schema datasource block — use `prisma.config.ts` for migration URL
- Prisma v7 PrismaClient requires a driver adapter (e.g., `@prisma/adapter-pg` with `pg` pool) — no more `new PrismaClient()` with no args
- For Next.js build without DATABASE_URL, use a Proxy object that defers the error to runtime
- NextAuth v5 MicrosoftEntraID: use `issuer` not `tenantId` — `issuer: \`https://login.microsoftonline.com/${TENANT_ID}/v2.0\``
- shadcn Avatar doesn't have a `size` prop — use className `size-7` instead
- shadcn Button `size="icon-xs"` and `size="icon-sm"` don't exist — use `size="icon"`
- Next.js 16: middleware file convention is deprecated, use "proxy" — but still works for now
