import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./db";
import { encrypt } from "./encryption";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`,
      authorization: {
        params: {
          scope:
            "openid profile email offline_access Mail.ReadWrite Mail.Send Calendars.ReadWrite User.Read",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // On initial sign-in, store tokens in DB (NOT in the JWT — keeps cookie small)
      if (account && user) {
        token.userId = user.id;

        // First user auto-promotion: make OWNER + ADMIN on all workspaces
        const userCount = await prisma.user.count();
        if (userCount === 1) {
          await prisma.user.update({
            where: { id: user.id as string },
            data: { role: "OWNER" },
          });

          const workspaces = await prisma.workspace.findMany({
            select: { id: true },
          });
          for (const ws of workspaces) {
            await prisma.workspaceMember.upsert({
              where: {
                workspaceId_userId: {
                  workspaceId: ws.id,
                  userId: user.id as string,
                },
              },
              update: { role: "ADMIN" },
              create: {
                workspaceId: ws.id,
                userId: user.id as string,
                role: "ADMIN",
              },
            });
          }
        }

        // Encrypt and store tokens in DB
        if (account.refresh_token) {
          const encryptedRefresh = encrypt(account.refresh_token);
          const encryptedAccess = account.access_token
            ? encrypt(account.access_token)
            : null;

          await prisma.user.update({
            where: { id: user.id as string },
            data: {
              microsoftRefreshToken: encryptedRefresh,
              microsoftAccessToken: encryptedAccess,
              tokenExpiry: account.expires_at
                ? new Date(account.expires_at * 1000)
                : null,
            },
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
