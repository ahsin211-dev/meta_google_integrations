/** Minimal Meta scopes for Pages + optional Instagram Business */
export const META_REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_metadata",
] as const;

export const META_INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_manage_insights",
] as const;

export function getMetaOAuthScopes(includeInstagram = true): string[] {
  const scopes: string[] = [...META_REQUIRED_SCOPES];
  if (includeInstagram) scopes.push(...META_INSTAGRAM_SCOPES);
  return scopes;
}

export function getMissingScopes(granted: string[], required: string[]): string[] {
  const set = new Set(granted);
  return required.filter((s) => !set.has(s));
}
