import { isFeatureEnabled } from "@/lib/env";

export const GOOGLE_BASE_SCOPES = ["openid", "email", "profile"] as const;

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const GOOGLE_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

export type GoogleModule = "calendar" | "meet" | "gmail";

export function getGoogleScopesForModules(modules: GoogleModule[]): string[] {
  const scopes = new Set<string>(GOOGLE_BASE_SCOPES);
  if (modules.includes("calendar") || modules.includes("meet")) {
    GOOGLE_CALENDAR_SCOPES.forEach((s) => scopes.add(s));
  }
  if (modules.includes("gmail") && isFeatureEnabled("google_gmail")) {
    GOOGLE_GMAIL_SCOPES.forEach((s) => scopes.add(s));
  }
  return [...scopes];
}

export function getMissingScopes(granted: string[], required: string[]): string[] {
  const set = new Set(granted);
  return required.filter((s) => !set.has(s));
}
