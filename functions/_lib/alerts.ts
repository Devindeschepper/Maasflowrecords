import type { Env } from './env';
import { configured, ensureTable, snapshotFollowers, SOURCES, STALE } from './followers';
import { db } from './studio';
import { NOT_CONNECTED } from './tiktok';
import { notifyWhatsApp } from './whatsapp';

/**
 * WhatsApp alerts after the hourly follower check (cron), sent as one message per run:
 *  - a milestone (100, 250, 500, 1,000 …) reached by an account or by all platforms together; each one only
 *    once, even if the count drops below it and comes back (KV 'milestone-<key>')
 *  - an account that grew much faster than normal in the last 24 hours (a post that works)
 *  - an account that lost DROP_MIN or more followers in the last 24 hours
 *  - an account that stopped updating (broken login or key), once when it breaks and once when it works again
 *    (KV 'followers-alerted')
 */
export const MILESTONES = [
  100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000,
  100000, 250000, 500000, 1000000,
];

/** Spike: at least SPIKE_MIN new followers in 24 hours and SPIKE_FACTOR times the normal daily growth. */
export const SPIKE_MIN = 10;
export const SPIKE_FACTOR = 3;
/** Drop: at least this many followers lost (net) in 24 hours. */
export const DROP_MIN = 10;
const SPIKE_BASE_DAYS = 14;
const DAY = 86400000;

const fmt = (n: number) => n.toLocaleString('en-US');
const reached = (n: number) => MILESTONES.filter((m) => m <= n).at(-1) ?? 0;

/** What VIN can do about a broken account. */
function fixHint(platform: string, ref: string, error: string): string {
  if (platform === 'tiktok') {
    return error === NOT_CONNECTED ? 'Fix: tap Connect on maasflowrecords.com/studio-stats/' : 'It is retried every hour.';
  }
  if (platform === 'instagram') return `Fix: probably a new Instagram token is needed (Cloudflare secret INSTAGRAM_TOKEN_${ref}).`;
  return 'Fix: check YOUTUBE_API_KEY in Cloudflare.';
}

/** Hourly cron: check followers, then send any alerts. */
export async function hourlyFollowers(env: Env, now = Date.now()): Promise<void> {
  const errors = await snapshotFollowers(env, now);
  const text = await followerAlerts(env, now, errors);
  if (text) await notifyWhatsApp(env, text);
}

/** The alert message for this run, or '' when there is nothing new. Saves what was announced. */
export async function followerAlerts(env: Env, now: number, errors: Record<string, string>): Promise<string> {
  const d = await db(env);
  if (!d || !env.STUDIO) return '';
  await ensureTable(d);
  const active = SOURCES.filter((s) => configured(env, s));
  const { results } = await d
    .prepare('SELECT s.source, s.at, s.count FROM follower_snapshots s JOIN (SELECT source, MAX(at) AS at FROM follower_snapshots GROUP BY source) m ON s.source = m.source AND s.at = m.at')
    .all<{ source: string; at: number; count: number }>();
  const latest = new Map(results.map((r) => [r.source, r]));
  const lines: string[] = [];

  // Milestones. The first time an account (or the total) is seen, its current level is saved without a message,
  // so connecting an account with 600 followers doesn't announce 100, 250 and 500.
  const milestone = async (key: string, label: string, count: number, unit: string) => {
    const level = reached(count);
    const saved = await env.STUDIO!.get(`milestone-${key}`);
    if (saved === null || level > Number(saved)) await env.STUDIO!.put(`milestone-${key}`, String(level));
    if (saved !== null && level > Number(saved)) lines.push(`🎉 ${label} just hit ${fmt(level)} ${unit} (now ${fmt(count)})`);
  };
  let total = 0;
  for (const s of active) {
    const row = latest.get(s.key);
    if (!row) continue;
    total += row.count;
    await milestone(s.key, s.label, row.count, s.platform === 'youtube' ? 'subscribers' : 'followers');
  }
  // The total only counts once every account has data, so connecting one doesn't look like a jump.
  if (active.length && active.every((s) => latest.has(s.key))) await milestone('total', 'All platforms', total, 'followers');

  // Spikes: an account that grew much faster than normal in the last 24 hours. "Normal" is its average daily
  // growth over the two weeks before; at most one alert per account per day (KV 'spike-<key>').
  const countAt = async (key: string, t: number) =>
    (await d.prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 AND at <= ?2 ORDER BY at DESC LIMIT 1').bind(key, t).first<{ at: number; count: number }>()) ??
    null;
  for (const s of active) {
    const now24 = latest.get(s.key);
    if (!now24 || now - now24.at > STALE) continue;
    const dayAgo = await countAt(s.key, now - DAY);
    const before = await countAt(s.key, now - SPIKE_BASE_DAYS * DAY - DAY);
    const oldest = await d.prepare('SELECT at, count FROM follower_snapshots WHERE source = ?1 ORDER BY at ASC LIMIT 1').bind(s.key).first<{ at: number; count: number }>();
    if (!dayAgo || now - dayAgo.at > DAY + STALE) continue;
    const gain = now24.count - dayAgo.count;
    // Drop: a clear net loss in 24 hours (unfollows after a post or a change), at most once a day.
    if (gain <= -DROP_MIN && !(await env.STUDIO.get(`drop-${s.key}`))) {
      await env.STUDIO.put(`drop-${s.key}`, '1', { expirationTtl: 86400 });
      lines.push(`📉 ${s.short}: −${fmt(-gain)} in the last 24 hours. Check if a post or a change made people unfollow.`);
      continue;
    }
    const base = before ?? oldest;
    if (!base || dayAgo.at - base.at < 3 * DAY) continue; // not enough history to know what's normal
    const normal = Math.max(0, (dayAgo.count - base.count) / ((dayAgo.at - base.at) / DAY));
    if (gain < Math.max(SPIKE_MIN, SPIKE_FACTOR * normal)) continue;
    if (await env.STUDIO.get(`spike-${s.key}`)) continue;
    await env.STUDIO.put(`spike-${s.key}`, '1', { expirationTtl: 86400 });
    const usual = normal < 1 ? 'normally less than 1 a day' : `normally ~${fmt(Math.round(normal))} a day`;
    lines.push(`📈 ${s.short}: +${fmt(gain)} in the last 24 hours (${usual}). Something's working, check your last post.`);
  }

  // Broken accounts: a TikTok login that is gone is reported at once; anything else only after it failed for a
  // few hours (one failed check is usually the platform having a hiccup).
  const alerted = new Set<string>(JSON.parse((await env.STUDIO.get('followers-alerted')) ?? '[]'));
  const broken: string[] = [];
  const fixed: string[] = [];
  for (const s of active) {
    const error = errors[s.key];
    const lastOk = latest.get(s.key)?.at ?? 0;
    if (error && (error === NOT_CONNECTED || now - lastOk >= STALE)) {
      if (!alerted.has(s.key)) broken.push(`⚠️ ${s.label} stopped updating (${error.slice(0, 80)}).\n${fixHint(s.platform, s.ref, error)}`);
      alerted.add(s.key);
    } else if (!error && alerted.has(s.key)) {
      fixed.push(`✅ ${s.label} is updating again.`);
      alerted.delete(s.key);
    }
  }
  for (const key of [...alerted]) if (!active.some((s) => s.key === key)) alerted.delete(key);
  await env.STUDIO.put('followers-alerted', JSON.stringify([...alerted]));

  const all = [...lines, ...broken, ...fixed];
  return all.length ? ['🔴 Maas Flow Records', ...all].join('\n') : '';
}
