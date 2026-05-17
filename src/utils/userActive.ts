export function parseActiveFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v || v === "yes" || v === "y" || v === "true" || v === "1" || v === "active")
    return true;
  return false;
}
