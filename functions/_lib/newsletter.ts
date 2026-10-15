import type { Env } from './env';

/**
 * Newsletter subscribers for the private stats page, read from the same Resend contact list the signup form
 * writes to (or the audience in RESEND_AUDIENCE_ID). Needs nothing new: RESEND_API_KEY already has contact
 * access. Cached in KV for an hour.
 */
export interface Newsletter {
  total: number;
  month: number;
  week: number;
  error?: string;
}

const PAGE = 100;
const MAX_PAGES = 50; // 5,000 contacts; plenty, and keeps one page load from making endless calls

/** Resend dates look like "2026-10-14 09:47:01.123+00"; make them parseable everywhere. */
function parseDate(s: unknown): number {
  const t = Date.parse(String(s ?? '').trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isFinite(t) ? t : 0;
}

/** All subscribed contacts (email + sign-up time in ms). Throws when Resend can't be read. */
export async function contactList(env: Env): Promise<{ email: string; at: number }[]> {
  const key = env.RESEND_API_KEY!.trim();
  const base = env.RESEND_AUDIENCE_ID
    ? `https://api.resend.com/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`
    : 'https://api.resend.com/contacts';
  const out: { email: string; at: number }[] = [];
  let after = '';
  const seen = new Set<string>(); // guards against counting a page twice if the API ignores `after`
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${base}?limit=${PAGE}${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: { id: string; email?: string; created_at?: string; unsubscribed?: boolean }[]; has_more?: boolean };
    const list = (body.data ?? []).filter((c) => !seen.has(c.id));
    for (const c of list) {
      seen.add(c.id);
      if (!c.unsubscribed) out.push({ email: c.email ?? '', at: parseDate(c.created_at) });
    }
    if (!body.has_more || !list.length) break;
    after = list[list.length - 1].id;
  }
  return out;
}

/** Sign-up times (ms) of all subscribed contacts. Throws when Resend can't be read. */
export async function contactDates(env: Env): Promise<number[]> {
  return (await contactList(env)).map((c) => c.at);
}

export async function newsletterStats(env: Env, now: number, monthStart: number): Promise<Newsletter | null> {
  if (!env.RESEND_API_KEY?.trim()) return null;
  const cached = await env.STUDIO?.get('newsletter-cache');
  if (cached) return JSON.parse(cached) as Newsletter;
  try {
    const dates = await contactDates(env);
    const result: Newsletter = {
      total: dates.length,
      month: dates.filter((at) => at >= monthStart).length,
      week: dates.filter((at) => at >= now - 7 * 86400000).length,
    };
    await env.STUDIO?.put('newsletter-cache', JSON.stringify(result), { expirationTtl: 3600 });
    return result;
  } catch (err) {
    console.error('Newsletter count failed', err);
    return { total: 0, month: 0, week: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
