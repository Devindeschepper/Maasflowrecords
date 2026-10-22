import type { Env } from './env';
import { db } from './studio';
import { ensureTable } from './followers';
import artists from '../../src/content/artists.json';

/**
 * VIN's Spotify monthly listeners for the private stats page. Spotify's API has no monthly listeners, so the
 * number is read from the public artist page (its description says "Artist · 1.2K monthly listeners").
 * Saved in the follower snapshots table (source 'sp-vin') every 6 hours, so the page can show the change.
 * Kept apart from the follower totals and alerts: listeners go up and down, they are not followers.
 */
const KEY = 'sp-vin';
const EVERY = 6 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

const vin = (artists as { artists?: { slug?: string; streaming?: Record<string, string> }[] }).artists?.find((a) => a.slug === 'vin');
const artistUrl = vin?.streaming?.spotify;

/** "1,234" → 1234, "1.2K" → 1200, "3M" → 3000000. */
export function parseListeners(html: string): number | null {
  const m = /([\d.,]+)\s*([KkMm])?\s+monthly listeners/.exec(html);
  if (!m) return null;
  const n = m[2] ? Number(m[1].replace(',', '.')) * (/[Mm]/.test(m[2]) ? 1e6 : 1e3) : Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function fetchListeners(): Promise<number> {
  if (!artistUrl) throw new Error('No Spotify link on VIN’s artist page');
  const res = await fetch(artistUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaasFlowRecords/1.0)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const n = parseListeners(await res.text());
  if (n === null) throw new Error('Monthly listeners not found on the Spotify page');
  return n;
}

/** Hourly cron: save a new number when the last one is 6 hours old. Never throws. */
export async function snapshotSpotify(env: Env, now = Date.now()): Promise<void> {
  try {
    const d = await db(env);
    if (!d || !artistUrl) return;
    await ensureTable(d);
    const last = await d.prepare('SELECT MAX(at) AS at FROM follower_snapshots WHERE source = ?1').bind(KEY).first<{ at: number | null }>();
    if (last?.at && now - last.at < EVERY) return;
    const n = await fetchListeners();
    await d.prepare('INSERT INTO follower_snapshots (source, at, count) VALUES (?1, ?2, ?3)').bind(KEY, now, n).run();
    await env.STUDIO?.delete('spotify-error');
  } catch (err) {
    console.error('Spotify listeners failed', err);
    await env.STUDIO?.put('spotify-error', err instanceof Error ? err.message : String(err));
  }
}

export interface SpotifyStats {
  count: number | null;
  /** Change over the last 7 days (null until there is a number from a week ago). */
  week: number | null;
  at: string | null;
  error?: string;
}

/** For the stats page. The first visit fetches a number right away. */
export async function spotifyStats(env: Env, now = Date.now()): Promise<SpotifyStats | null> {
  const d = await db(env);
  if (!d || !artistUrl) return null;
  await ensureTable(d);
  const latest = () => d.prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 ORDER BY at DESC LIMIT 1').bind(KEY).first<{ at: number; count: number }>();
  let row = await latest();
  if (!row) {
    await snapshotSpotify(env, now);
    row = await latest();
  }
  const error = (await env.STUDIO?.get('spotify-error')) ?? undefined;
  if (!row) return { count: null, week: null, at: null, error: error ?? 'No number yet' };
  const old = await d
    .prepare('SELECT count FROM follower_snapshots WHERE source = ?1 AND at <= ?2 ORDER BY at DESC LIMIT 1')
    .bind(KEY, now - 7 * DAY)
    .first<{ count: number }>();
  return { count: row.count, week: old ? row.count - old.count : null, at: new Date(row.at).toISOString(), ...(error ? { error } : {}) };
}
