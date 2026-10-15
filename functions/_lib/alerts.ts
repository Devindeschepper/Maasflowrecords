import type { Env } from './env';
import { configured, ensureTable, snapshotFollowers, SOURCES, STALE } from './followers';
import { db } from './studio';
import { NOT_CONNECTED } from './tiktok';
import { notifyWhatsApp } from './whatsapp';

/**
 * WhatsApp alerts after the hourly follower check (cron), sent as one message per run:
 *  - a milestone (100, 250, 500, 1,000 …) reached by an account or by all platforms together; each one only
 *    once, even if the count drops below it and comes back (KV 'milestone-<key>')
 *  - an account that stopped updating (broken login or key), once when it breaks and once when it works again
 *    (KV 'followers-alerted')
 */
export const MILESTONES = [
  100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 75000,
  100000, 250000, 500000, 1000000,
];

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
