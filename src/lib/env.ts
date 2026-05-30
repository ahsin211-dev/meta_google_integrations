import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OAUTH_STATE_SECRET: z.string().min(16).optional(),
  INTEGRATION_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  FEATURE_META_INTEGRATION: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  FEATURE_GOOGLE_INTEGRATION: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  FEATURE_GOOGLE_GMAIL: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_GRAPH_API_VERSION: z.string().default("v21.0"),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_WEBHOOK_CHANNEL_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  return cached;
}

export function isFeatureEnabled(flag: "meta" | "google" | "google_gmail"): boolean {
  const env = getEnv();
  switch (flag) {
    case "meta":
      return env.FEATURE_META_INTEGRATION;
    case "google":
      return env.FEATURE_GOOGLE_INTEGRATION;
    case "google_gmail":
      return env.FEATURE_GOOGLE_GMAIL;
  }
}

export function requireMetaConfig() {
  const env = getEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_OAUTH_REDIRECT_URI) {
    throw new Error("Meta OAuth is not configured");
  }
  return {
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    redirectUri: env.META_OAUTH_REDIRECT_URI,
    graphVersion: env.META_GRAPH_API_VERSION,
    webhookVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? "",
  };
}

export function requireGoogleConfig() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured");
  }
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  };
}

export function metaGraphBaseUrl(): string {
  return `https://graph.facebook.com/${getEnv().META_GRAPH_API_VERSION}`;
}
