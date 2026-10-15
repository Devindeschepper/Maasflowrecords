import type { Env } from './env';
import { followerTotals } from './followers';
import { contactDates } from './newsletter';
import { fmt, signed } from './report';
import { db, fmtDuration, luxParts, monthStart, STALE_MS, summarize, type Session } from './studio';
import { visitorsConfigured, visitsInRanges } from './visitors';
import { notifyWhatsApp } from './whatsapp';

/**
 * "VIN Wrapped": the year in numbers. Shown on /studio-stats/ in December and January (or with ?wrapped to
 * preview it) and sent on WhatsApp on 31 December at 18:00 Luxembourg time.
 */
export interface Wrapped {
  year: number;
  /** Set when the studio tracking started during the year ("since 12 Oct"). */
  since: string | null;
  studio: { ms: number; sessions: number; knocks: number; days: number; streak: number } | null;
  longest: { ms: number; date: string } | null;
  bestMonth: { name: string; ms: number } | null;
  followers: { total: number; change: number } | null;
  visits: number | null;
  newsletter: { total: number; added: number } | null;
}

const DAY = 86400000;
const TZ = 'Europe/Luxembourg';
const shortDate = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
const dayKey = (t: number) => {
  const p = luxParts(t);
  return Date.UTC(p.year, p.month - 1, p.day) / DAY; // whole days, so neighbours differ by 1
};
const yearStart = (year: number) => monthStart(Date.UTC(year, 0, 1, 12));

/** Which year the stats page shows: this year in December, last year in January, else only on request. */
export function wrappedYear(now: number, preview: boolean): number | null {
  const p = luxParts(now);
  if (p.month === 12 || preview) return p.year;
  if (p.month === 1) return p.year - 1;
  return null;
}

export async function wrappedStats(env: Env, year: number, now: number): Promise<Wrapped> {
  const from = yearStart(year);
  const to = Math.min(now, yearStart(year + 1));
  const w: Wrapped = { year, since: null, studio: null, longest: null, bestMonth: null, followers: null, visits: null, newsletter: null };

  const d = await db(env);
  if (d) {
    const { results } = await d
      .prepare('SELECT * FROM sessions WHERE started_at < ?2 AND (ended_at IS NULL OR ended_at > ?1)')
      .bind(from, to)
      .all<Session>();
    const first = await d.prepare('SELECT MIN(started_at) AS t FROM sessions').first<{ t: number | null }>();
    if (first?.t && first.t > from + DAY) w.since = shortDate(first.t);
    if (results.length) {
      const sum = summarize(results, from, to);
      const days = new Set<number>();
      for (const s of results) {
        const start = Math.max(s.started_at, from);
        const end = Math.min(s.ended_at ?? Math.min(to, s.last_beat + STALE_MS), to);
        if (end - start < 60000) continue;
        if (!w.longest || end - start > w.longest.ms) w.longest = { ms: end - start, date: shortDate(start) };
        for (let t = start; t < end; t += 3600000) days.add(dayKey(t));
        days.add(dayKey(end - 1));
      }
      const sorted = [...days].sort((a, b) => a - b);
      let streak = 0;
      let run = 0;
      sorted.forEach((k, i) => {
        run = i && k === sorted[i - 1] + 1 ? run + 1 : 1;
        streak = Math.max(streak, run);
      });
      w.studio = { ms: sum.ms, sessions: sum.sessions, knocks: sum.knocks, days: days.size, streak };
      for (let m = 0; m < 12; m++) {
        const ms = summarize(results, monthStart(Date.UTC(year, m, 1, 12)), monthStart(Date.UTC(year, m + 1, 1, 12))).ms;
        if (ms > 0 && (!w.bestMonth || ms > w.bestMonth.ms)) {
          w.bestMonth = { name: new Date(Date.UTC(year, m, 15)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' }), ms };
        }
      }
    }
  }

  w.followers = await followerTotals(env, from, to).catch(() => null);

  if (visitorsConfigured(env)) {
    // One range per month up to now (Web Analytics only answers a month at a time). If old months are out of
    // reach, the last six are enough: the site went live this autumn.
    const iso = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
    const ranges: [string, string][] = [];
    for (let m = 0; m < 12; m++) {
      const a = monthStart(Date.UTC(year, m, 1, 12));
      if (a >= to) break;
      ranges.push([iso(a), iso(Math.min(to, monthStart(Date.UTC(year, m + 1, 1, 12))) - 1)]);
    }
    for (const list of [ranges, ranges.slice(-6)]) {
      try {
        w.visits = (await visitsInRanges(env, list)).reduce((a, b) => a + b, 0);
        break;
      } catch (err) {
        console.error('Wrapped: visitors failed', err);
      }
    }
  }

  if (env.RESEND_API_KEY?.trim()) {
    try {
      const dates = await contactDates(env);
      w.newsletter = { total: dates.filter((t) => t < to).length, added: dates.filter((t) => t >= from && t < to).length };
    } catch (err) {
      console.error('Wrapped: newsletter failed', err);
    }
  }
  return w;
}

export function wrappedText(w: Wrapped): string {
  const lines = [`🔴 VIN Wrapped ${w.year}`, ''];
  if (w.studio) {
    lines.push(`🎧 Studio: ${fmtDuration(w.studio.ms)} in ${w.studio.sessions} sessions${w.since ? ` (since ${w.since})` : ''}`);
    if (w.longest) lines.push(`⏱ Longest session: ${fmtDuration(w.longest.ms)} (${w.longest.date})`);
    if (w.bestMonth) lines.push(`📅 Best month: ${w.bestMonth.name} (${fmtDuration(w.bestMonth.ms)})`);
    if (w.studio.streak > 1) lines.push(`🔥 Longest streak: ${w.studio.streak} days in a row`);
    if (w.studio.knocks) lines.push(`🚪 Knocks: ${fmt(w.studio.knocks)}`);
  }
  if (w.followers) lines.push(`👥 Followers: ${fmt(w.followers.total)} (${signed(w.followers.change)} this year)`);
  if (w.visits !== null) lines.push(`🌐 Website: ${fmt(w.visits)} visits`);
  if (w.newsletter) lines.push(`📩 Newsletter: ${fmt(w.newsletter.total)} subscribers (${signed(w.newsletter.added)} this year)`);
  lines.push('', 'Full card: maasflowrecords.com/studio-stats/');
  return lines.join('\n');
}

/** Hourly cron: on 31 December at 18:00 Luxembourg time, the Wrapped on WhatsApp (once). */
export async function wrappedMessage(env: Env, now: number): Promise<void> {
  const p = luxParts(now);
  if (p.month !== 12 || p.day !== 31 || p.hour !== 18 || !env.STUDIO) return;
  const key = `wrapped-sent-${p.year}`;
  if (await env.STUDIO.get(key)) return;
  await env.STUDIO.put(key, '1', { expirationTtl: 40 * 86400 });
  await notifyWhatsApp(env, wrappedText(await wrappedStats(env, p.year, now)));
}
