/**
 * Utilities for handling single and multiple receipt attachments
 * across all expense forms and ledgers (up to 5 attachments).
 */

export function parseReceiptUrls(bill_url?: string | null): string[] {
  if (!bill_url) return [];
  const trimmed = bill_url.trim();
  if (!trimmed) return [];

  // 1. Try parsing JSON array format: ["https://...", "https://..."]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map(item => item.trim());
      }
    } catch {
      // Fallback if malformed JSON
    }
  }

  // 2. Check for comma-separated or newline-separated URLs
  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
  }
  if (trimmed.includes(',')) {
    return trimmed.split(',').map(s => s.trim()).filter(Boolean);
  }

  // 3. Single URL
  return [trimmed];
}

export function formatReceiptUrls(urls: string[]): string | null {
  const filtered = urls.map(u => u.trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  if (filtered.length === 1) return filtered[0];
  return JSON.stringify(filtered);
}

export function getReceiptCount(bill_url?: string | null): number {
  return parseReceiptUrls(bill_url).length;
}
