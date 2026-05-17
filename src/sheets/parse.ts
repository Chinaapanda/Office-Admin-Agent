/** Trim and treat empty as undefined for optional fields */
export function cell(row: string[], i: number): string {
  const v = row[i];
  return v === undefined || v === null ? "" : String(v).trim();
}
