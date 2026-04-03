export function parseSmartcardEntries(value: string | null | undefined): string[] {
  const normalized = (value ?? '')
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

export function formatSmartcardEntries(entries: string[] | null | undefined): string {
  if (!entries || entries.length === 0) {
    return 'None recorded.';
  }

  return entries.join(', ');
}