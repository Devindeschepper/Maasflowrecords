import type { Env } from './env';

/**
 * Website visitors for the private stats page, from Cloudflare Web Analytics (GraphQL Analytics API,
 * dataset rumPageloadEventsAdaptiveGroups). Needs three settings:
 *   CF_ACCOUNT_ID            - Cloudflare account id (in every dashboard URL)
 *   CF_WEB_ANALYTICS_SITE    - the Web Analytics site tag of maasflowrecords.com
 *   CF_ANALYTICS_TOKEN       - API token with Account → Account Analytics → Read (secret)
 * The result is cached in KV for an hour.
 */
export interface Visitors {
  visits: number;
  views: number;
  prevVisits: number;
  prevViews: number;
  days: { date: string; visits: number; views: number }[];
  pages: { path: string; views: number }[];
  error?: string;
}

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function visitorsConfigured(env: Env): boolean {
  return !!(env.CF_ACCOUNT_ID?.trim() && env.CF_WEB_ANALYTICS_SITE?.trim() && env.CF_ANALYTICS_TOKEN?.trim());
}

export async function visitorStats(env: Env, now = Date.now()): Promise<Visitors | null> {
  if (!visitorsConfigured(env)) return null;
  const cached = await env.STUDIO?.get('visitors-cache');
  if (cached) return JSON.parse(cached) as Visitors;

  const acc = env.CF_ACCOUNT_ID!.trim();
  const site = env.CF_WEB_ANALYTICS_SITE!.trim();
  if (!/^[a-f0-9]{32}$/i.test(acc) || !/^[a-z0-9-]{8,64}$/i.test(site)) {
    return { visits: 0, views: 0, prevVisits: 0, prevViews: 0, days: [], pages: [], error: 'Account id or site tag looks wrong' };
  }

  // Last 7 days (incl. today) and the 7 days before, by day; top pages for the last 7 days.
  const today = iso(now);
  const from14 = iso(now - 13 * DAY);
  const from7 = iso(now - 6 * DAY);
  const query = `{
    viewer { accounts(filter: { accountTag: "${acc}" }) {
      days: rumPageloadEventsAdaptiveGroups(limit: 100, filter: { siteTag: "${site}", date_geq: "${from14}", date_leq: "${today}" }, orderBy: [date_ASC]) {
        count sum { visits } dimensions { date }
      }
      pages: rumPageloadEventsAdaptiveGroups(limit: 5, filter: { siteTag: "${site}", date_geq: "${from7}", date_leq: "${today}" }, orderBy: [count_DESC]) {
        count dimensions { requestPath }
      }
    } }
  }`;

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN!.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json()) as {
      data?: { viewer?: { accounts?: { days?: { count: number; sum: { visits: number }; dimensions: { date: string } }[]; pages?: { count: number; dimensions: { requestPath: string } }[] }[] } };
      errors?: { message: string }[] | null;
    };
    if (!res.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message ?? `HTTP ${res.status}`);
    const a = body.data?.viewer?.accounts?.[0];

    const byDate = new Map((a?.days ?? []).map((d) => [d.dimensions.date, { visits: d.sum.visits, views: d.count }]));
    const days = Array.from({ length: 14 }, (_, i) => {
      const date = iso(now - (13 - i) * DAY);
      return { date, ...(byDate.get(date) ?? { visits: 0, views: 0 }) };
    });
    const sum = (list: typeof days, k: 'visits' | 'views') => list.reduce((n, d) => n + d[k], 0);
    const result: Visitors = {
      visits: sum(days.slice(7), 'visits'),
      views: sum(days.slice(7), 'views'),
      prevVisits: sum(days.slice(0, 7), 'visits'),
      prevViews: sum(days.slice(0, 7), 'views'),
      days: days.slice(7),
      pages: (a?.pages ?? []).map((p) => ({ path: p.dimensions.requestPath, views: p.count })),
    };
    await env.STUDIO?.put('visitors-cache', JSON.stringify(result), { expirationTtl: 3600 });
    return result;
  } catch (err) {
    console.error('Web Analytics query failed', err);
    return { visits: 0, views: 0, prevVisits: 0, prevViews: 0, days: [], pages: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Visits per date range (inclusive YYYY-MM-DD, each at most a month), one query. Throws on failure. */
export async function visitsInRanges(env: Env, ranges: [string, string][]): Promise<number[]> {
  const acc = env.CF_ACCOUNT_ID!.trim();
  const site = env.CF_WEB_ANALYTICS_SITE!.trim();
  if (!/^[a-f0-9]{32}$/i.test(acc) || !/^[a-z0-9-]{8,64}$/i.test(site)) throw new Error('Account id or site tag looks wrong');
  const date = /^\d{4}-\d\d-\d\d$/;
  const parts = ranges.map(([from, to], i) => {
    if (!date.test(from) || !date.test(to)) throw new Error('Bad date');
    return `r${i}: rumPageloadEventsAdaptiveGroups(limit: 1, filter: { siteTag: "${site}", date_geq: "${from}", date_leq: "${to}" }) { sum { visits } }`;
  });
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN!.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `{ viewer { accounts(filter: { accountTag: "${acc}" }) { ${parts.join('\n')} } } }` }),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json()) as { data?: { viewer?: { accounts?: Record<string, { sum: { visits: number } }[]>[] } }; errors?: { message: string }[] | null };
  if (!res.ok || body.errors?.length) throw new Error(body.errors?.[0]?.message ?? `HTTP ${res.status}`);
  const a = body.data?.viewer?.accounts?.[0] ?? {};
  return ranges.map((_, i) => a[`r${i}`]?.[0]?.sum.visits ?? 0);
}
