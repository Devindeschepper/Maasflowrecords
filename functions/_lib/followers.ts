import type { Env } from './env';
import { db } from './studio';
import { tiktokConfigured, tiktokFollowers } from './tiktok';

/**
 * Follower counts for the private stats page (not sent on WhatsApp).
 * A daily cron (and opening /studio-stats/ when the data is older than 6 hours) saves a snapshot per
 * account in D1, so the page can show growth over the last 7 days.
 *
 * Each source only runs when its key is set as a Cloudflare secret:
 *   YOUTUBE_API_KEY                         - YouTube Data API v3 key (Google Cloud, free)
 *   INSTAGRAM_TOKEN_VIN / INSTAGRAM_TOKEN_MFR - Instagram API (Instagram Login) user tokens; refreshed
 *                                             automatically and the newest copy kept in KV
 *   TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET  - TikTok app; VIN connects once on the page (see ./tiktok.ts)
 */
interface Source {
  key: string;
  label: string;
  platform: 'instagram' | 'youtube' | 'tiktok';
  /** YouTube: channel id (UC…) or handle (@…). Instagram: which token. TikTok: which connected account. */
  ref: string;
}

export const SOURCES: Source[] = [
  { key: 'ig-vin', label: 'Instagram · @vintheartist', platform: 'instagram', ref: 'VIN' },
  { key: 'ig-mfr', label: 'Instagram · @maasflowrecords', platform: 'instagram', ref: 'MFR' },
  { key: 'yt-vin', label: 'YouTube · VIN', platform: 'youtube', ref: 'UC8dDWNLNjAxwDzcRoadqSvg' },
  { key: 'yt-mfr', label: 'YouTube · Maas Flow Records', platform: 'youtube', ref: '@MaasFlowRecords' },
  { key: 'yt-beats', label: 'YouTube · VIN Beats', platform: 'youtube', ref: '@VINBeats1' },
  { key: 'tt-vin', label: 'TikTok · VIN', platform: 'tiktok', ref: 'VIN' },
  { key: 'tt-mfr', label: 'TikTok · Maas Flow Records', platform: 'tiktok', ref: 'MFR' },
];

const DAY = 24 * 3600 * 1000;
const STALE = 6 * 3600 * 1000;

async function ensureTable(d: D1Database) {
  await d.batch([
    d.prepare('CREATE TABLE IF NOT EXISTS follower_snapshots (source TEXT NOT NULL, at INTEGER NOT NULL, count INTEGER NOT NULL)'),
    d.prepare('CREATE INDEX IF NOT EXISTS follower_snapshots_src ON follower_snapshots (source, at)'),
  ]);
}

const getJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
};

async function youtube(env: Env, ref: string): Promise<number> {
  const by = ref.startsWith('@') ? `forHandle=${encodeURIComponent(ref)}` : `id=${encodeURIComponent(ref)}`;
  const data = await getJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&${by}&key=${env.YOUTUBE_API_KEY}`);
  const n = Number((data.items as { statistics?: { subscriberCount?: string } }[] | undefined)?.[0]?.statistics?.subscriberCount);
  if (!Number.isFinite(n)) throw new Error('Channel not found or subscriber count hidden');
  return n;
}

async function instagramToken(env: Env, ref: string): Promise<string | undefined> {
  const fromSecret = ref === 'VIN' ? env.INSTAGRAM_TOKEN_VIN : env.INSTAGRAM_TOKEN_MFR;
  if (!fromSecret?.trim()) return undefined;
  // A refreshed token (saved by refreshInstagramTokens) wins over the original secret.
  return (await env.STUDIO?.get(`ig-token-${ref}`)) ?? fromSecret.trim();
}

async function instagram(env: Env, ref: string): Promise<number> {
  const token = await instagramToken(env, ref);
  const data = await getJson(`https://graph.instagram.com/me?fields=username,followers_count&access_token=${encodeURIComponent(token ?? '')}`);
  const n = Number(data.followers_count);
  if (!Number.isFinite(n)) throw new Error('No follower count (is it a Professional account?)');
  return n;
}

/** Instagram tokens last 60 days; refreshing once a week keeps them alive forever. */
export async function refreshInstagramTokens(env: Env): Promise<void> {
  if (!env.STUDIO) return;
  for (const ref of ['VIN', 'MFR']) {
    const token = await instagramToken(env, ref);
    if (!token) continue;
    try {
      const data = await getJson(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
      if (typeof data.access_token === 'string') await env.STUDIO.put(`ig-token-${ref}`, data.access_token);
    } catch (err) {
      console.error(`Instagram token refresh failed (${ref})`, err);
    }
  }
}

function configured(env: Env, s: Source): boolean {
  if (s.platform === 'youtube') return !!env.YOUTUBE_API_KEY?.trim();
  if (s.platform === 'tiktok') return tiktokConfigured(env);
  return !!(s.ref === 'VIN' ? env.INSTAGRAM_TOKEN_VIN : env.INSTAGRAM_TOKEN_MFR)?.trim();
}

/** Fetches every configured account and saves a snapshot. Errors are kept per account, never thrown. */
export async function snapshotFollowers(env: Env, now = Date.now()): Promise<Record<string, string>> {
  const d = await db(env);
  const errors: Record<string, string> = {};
  if (!d) return errors;
  await ensureTable(d);
  for (const s of SOURCES.filter((src) => configured(env, src))) {
    try {
      const n =
        s.platform === 'youtube' ? await youtube(env, s.ref)
        : s.platform === 'tiktok' ? await tiktokFollowers(env, s.ref, now)
        : await instagram(env, s.ref);
      await d.prepare('INSERT INTO follower_snapshots (source, at, count) VALUES (?1, ?2, ?3)').bind(s.key, now, n).run();
    } catch (err) {
      errors[s.key] = err instanceof Error ? err.message : String(err);
      console.error(`Follower count failed (${s.key})`, err);
    }
  }
  if (env.STUDIO) await env.STUDIO.put('followers-errors', JSON.stringify(errors));
  return errors;
}

export interface FollowerRow {
  key: string;
  label: string;
  platform: Source['platform'];
  count: number | null;
  /** Change over the last 7 / 30 days (null with only one snapshot so far). */
  week: number | null;
  month: number | null;
  /** Set when there is less history than 30 days: the change is counted from this date instead. */
  monthSince: string | null;
  at: string | null;
  error?: string;
}

/** Latest count + 7- and 30-day change per configured account (refreshes first when the data is older than 6 hours). */
export async function followerSummary(env: Env, now = Date.now()): Promise<FollowerRow[]> {
  const d = await db(env);
  if (!d) return [];
  await ensureTable(d);
  const active = SOURCES.filter((s) => configured(env, s));
  if (!active.length) return [];

  // Refresh when any account's data is older than 6 hours, or when an account was just added and has no
  // data yet (retried at most every 10 minutes, so a broken token doesn't call the API on every page load).
  const { results: latest } = await d.prepare('SELECT source, MAX(at) AS at FROM follower_snapshots GROUP BY source').all<{ source: string; at: number }>();
  const lastAt = new Map(latest.map((r) => [r.source, r.at]));
  const stale = active.some((s) => now - (lastAt.get(s.key) ?? 0) > STALE);
  const lastTry = Number((await env.STUDIO?.get('followers-last-try')) ?? 0);
  let errors: Record<string, string> = JSON.parse((await env.STUDIO?.get('followers-errors')) ?? '{}');
  if (stale && now - lastTry > 10 * 60 * 1000) {
    await env.STUDIO?.put('followers-last-try', String(now));
    errors = await snapshotFollowers(env, now);
  }

  const rows: FollowerRow[] = [];
  for (const s of active) {
    const last = await d.prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 ORDER BY at DESC LIMIT 1').bind(s.key).first<{ at: number; count: number }>();
    // Baseline: the newest snapshot at least N days old; with less history, the first snapshot ever.
    const since = async (days: number) => {
      const full = await d
        .prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 AND at <= ?2 ORDER BY at DESC LIMIT 1')
        .bind(s.key, now - days * DAY + 3600 * 1000)
        .first<{ at: number; count: number }>();
      if (full) return { ...full, partial: false };
      const first = await d.prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 ORDER BY at ASC LIMIT 1').bind(s.key).first<{ at: number; count: number }>();
      return first && last && first.at < last.at ? { ...first, partial: true } : null;
    };
    const [w, m] = [await since(7), await since(30)];
    rows.push({
      key: s.key,
      label: s.label,
      platform: s.platform,
      count: last?.count ?? null,
      week: last && w ? last.count - w.count : null,
      month: last && m ? last.count - m.count : null,
      monthSince: m?.partial ? new Date(m.at).toISOString() : null,
      at: last ? new Date(last.at).toISOString() : null,
      error: errors[s.key],
    });
  }
  return rows;
}
