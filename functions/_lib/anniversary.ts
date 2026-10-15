import type { Env } from './env';
import { luxParts } from './studio';
import { notifyWhatsApp } from './whatsapp';

/**
 * Release anniversaries: on the day a release on the website turns 1, 2, 3 … years old, a WhatsApp at 10:00
 * Luxembourg time with a throwback-post idea. The release list comes from /release-dates.json (built with the
 * site from src/content/releases), so only releases on the website count.
 */
export interface ReleaseDate {
  slug: string;
  title: string;
  type: string;
  date: string; // YYYY-MM-DD
}

/** The message for the given Luxembourg date, or '' when nothing has its anniversary. */
export function anniversaryText(list: ReleaseDate[], year: number, month: number, day: number): string {
  const lines = list
    .map((r) => ({ r, m: /^(\d{4})-(\d\d)-(\d\d)$/.exec(r.date) }))
    .filter(({ m }) => m && Number(m[2]) === month && Number(m[3]) === day && Number(m[1]) < year)
    .map(({ r, m }) => {
      const years = year - Number(m![1]);
      return `🎂 ${years} year${years === 1 ? '' : 's'} ago today: ${r.title} came out.\nThrowback post? maasflowrecords.com/music/${r.slug}/`;
    });
  return lines.length ? ['🔴 Maas Flow Records', ...lines].join('\n') : '';
}

/** Hourly cron: at 10:00 Luxembourg time, once per day. */
export async function releaseAnniversaries(env: Env, now: number, load: () => Promise<ReleaseDate[]>): Promise<void> {
  const p = luxParts(now);
  if (p.hour !== 10 || !env.STUDIO) return;
  const key = `anniversary-${p.year}-${p.month}-${p.day}`;
  if (await env.STUDIO.get(key)) return;
  try {
    const text = anniversaryText(await load(), p.year, p.month, p.day);
    await env.STUDIO.put(key, '1', { expirationTtl: 2 * 86400 });
    if (text) await notifyWhatsApp(env, text);
  } catch (err) {
    console.error('Release anniversaries failed', err);
  }
}
