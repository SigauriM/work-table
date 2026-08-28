export const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

/** Comma-separated allowlist. Empty / missing / only `*` → localhost defaults. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === "") {
    return [...DEFAULT_CORS_ORIGINS];
  }
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "*");
  return list.length > 0 ? list : [...DEFAULT_CORS_ORIGINS];
}
