import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url().optional(),
    AZURE_AD_CLIENT_ID: z.string().min(1),
    AZURE_AD_CLIENT_SECRET: z.string().min(1),
    AZURE_AD_TENANT_ID: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().length(64), // 32 bytes hex
    DAILY_EMAIL_LIMIT_PER_DOMAIN: z.coerce.number().default(20),
    SEND_DELAY_SECONDS: z.coerce.number().default(30),
    SEND_WINDOW_START: z.coerce.number().default(8),
    SEND_WINDOW_END: z.coerce.number().default(18),
  },
  experimental__runtimeEnv: {},
});
