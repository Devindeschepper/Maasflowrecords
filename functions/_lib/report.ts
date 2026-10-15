import type { Env } from './env';
import { configured, ensureTable, SOURCES } from './followers';
import { contactDates } from './newsletter';
import { db, monthStart } from './studio';
import { visitorsConfigured, visitsInRanges } from './visitors';
import { notifyWhatsApp } from './whatsapp';

/**
 * Monthly WhatsApp report (cron on the 1st, see wrangler.toml): followers per account and in total with the
 * change over the month that just ended, website visits compared with the month before, and newsletter
 * subscribers. Each part is left out when it isn't set up or can't be read.
 */
const fmt = (n: number) => n.toLocaleString('en-US');
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0');
const TZ = 'Europe/Luxembourg';
const localDate = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
const monthName = (t: number) => new Date(t).toLocaleString('en-US', { month: 'long', timeZone: TZ });

export async function monthlyReportText(env: Env, now: number): Promise<string> {
  const end = monthStart(now); // start of this month = end of the reported month
  const start = monthStart(end - 1);
  const before = monthStart(start - 1);
  const lines = [`🔴 Maas Flow Records · ${monthName(start)}`];

  // Followers: the last count of the month against the last count before it started (or the first count ever
  // for accounts connected during the month).
  const d = await db(env);
  if (d) {
    await ensureTable(d);
    const rows: string[] = [];
    let total = 0;
    let totalChange = 0;
    for (const s of SOURCES.filter((src) => configured(env, src))) {
      const at = (q: string, t: number) => d.prepare(q).bind(s.key, t).first<{ count: number }>();
      const last = await at('SELECT count FROM follower_snapshots WHERE source = ?1 AND at < ?2 ORDER BY at DESC LIMIT 1', end);
      if (!last) continue;
      const first =
        (await at('SELECT count FROM follower_snapshots WHERE source = ?1 AND at < ?2 ORDER BY at DESC LIMIT 1', start)) ??
        (await at('SELECT count FROM follower_snapshots WHERE source = ?1 AND at >= ?2 ORDER BY at ASC LIMIT 1', start))!;
      total += last.count;
      totalChange += last.count - first.count;
      rows.push(`${s.short}: ${fmt(last.count)} (${signed(last.count - first.count)})`);
    }
    if (rows.length) lines.push('', `👥 Followers: ${fmt(total)} (${signed(totalChange)})`, ...rows);
  }

  if (visitorsConfigured(env)) {
    try {
      const [visits, prev] = await visitsInRanges(env, [
        [localDate(start), localDate(end - 1)],
        [localDate(before), localDate(start - 1)],
      ]);
      lines.push('', `🌐 Website: ${fmt(visits)} visits (${signed(visits - prev)} vs ${monthName(before)})`);
    } catch (err) {
      console.error('Monthly report: visitors failed', err);
    }
  }

  if (env.RESEND_API_KEY?.trim()) {
    try {
      const dates = await contactDates(env);
      const total = dates.filter((t) => t < end).length;
      const added = dates.filter((t) => t >= start && t < end).length;
      lines.push('', `📩 Newsletter: ${fmt(total)} subscribers (${signed(added)} new)`);
    } catch (err) {
      console.error('Monthly report: newsletter failed', err);
    }
  }

  lines.push('', 'maasflowrecords.com/studio-stats/');
  return lines.join('\n');
}

export async function monthlyReport(env: Env, now = Date.now()): Promise<void> {
  await notifyWhatsApp(env, await monthlyReportText(env, now));
}
