/** First-token display label from an Account full name. */
export function accountDisplayName(fullName: string | null | undefined): string {
  const trimmed = fullName?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

/** Read `full_name` from Supabase Auth user_metadata. */
export function accountFullNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string {
  const value = metadata?.full_name;
  return typeof value === "string" ? value : "";
}
