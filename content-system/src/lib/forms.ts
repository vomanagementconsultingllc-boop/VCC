/** Result shape every form Server Action returns. */
export type ActionState = { error?: string; ok?: string } | null;

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Split a comma- or newline-separated field into a clean list. */
export function list(formData: FormData, name: string): string[] {
  return splitList(text(formData, name));
}

export function splitList(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(/[\n,]/)) {
    const item = part.trim();
    const key = item.toLowerCase();
    if (item && !seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

/** Tags are lower-cased so "Bakery" and "bakery" are the same niche. */
export function tags(formData: FormData, name: string): string[] {
  return splitList(text(formData, name).toLowerCase());
}

export function intOrNull(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Dollars typed by a person ("20", "20.50", "$1,200") to integer cents. */
export function dollarsToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
