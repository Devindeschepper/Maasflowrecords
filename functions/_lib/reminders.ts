import type { Env } from './env';
import { luxParts } from './studio';
import { notifyWhatsApp } from './whatsapp';

/**
 * Dated WhatsApp reminders (renewals and to-dos), sent at 10:00 Luxembourg time on their day, once each
 * (KV 'reminder-<date>'). Add a line to REMINDERS for a new one.
 */
export const REMINDERS: { date: string; text: string }[] = [
  {
    // One month before the domain expires at Gandi (22 Sep 2027).
    date: '2027-08-22',
    text: [
      '🌐 Your domain maasflowrecords.com expires at Gandi in 1 month (22 Sep 2027). Move it to Cloudflare now (about €10 a year, renews by itself):',
      '1. Gandi: turn off the transfer lock and get the auth code',
      '2. Cloudflare: Domain Registration → Transfer Domains',
      'Check first that your info@ email keeps working after the move.',
    ].join('\n'),
  },
];

/** Hourly cron: at 10:00 Luxembourg time, sends the reminders dated today. */
export async function dueReminders(env: Env, now: number): Promise<void> {
  const p = luxParts(now);
  if (p.hour !== 10 || !env.STUDIO) return;
  const today = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  const due = REMINDERS.filter((r) => r.date === today);
  if (!due.length || (await env.STUDIO.get(`reminder-${today}`))) return;
  await env.STUDIO.put(`reminder-${today}`, '1', { expirationTtl: 2 * 86400 });
  await notifyWhatsApp(env, ['🔴 Maas Flow Records', ...due.map((r) => r.text)].join('\n'));
}
