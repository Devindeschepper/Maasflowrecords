import type { Env } from './env';
import { luxParts } from './studio';
import { notifyWhatsApp } from './whatsapp';

/**
 * Dated WhatsApp reminders (renewals and to-dos), sent at 10:00 Luxembourg time on their day, once each
 * (KV 'reminder-<date>'). Add a line to REMINDERS for a new one.
 */
export const REMINDERS: { date: string; text: string }[] = [
  {
    // Gandi registration was ~22 Sep 2026; a transfer is only allowed 60 days after registering.
    date: '2026-11-23',
    text: [
      '🌐 Your domain maasflowrecords.com can now move from Gandi to Cloudflare (about €10 a year, renews by itself).',
      '1. Gandi: turn off the transfer lock and get the auth code',
      '2. Cloudflare: Domain Registration → Transfer Domains',
      'Check first that your info@ email keeps working after the move.',
    ].join('\n'),
  },
  {
    date: '2027-08-23',
    text: '⏰ maasflowrecords.com expires at Gandi in 30 days (22 Sep 2027). Move it to Cloudflare now, or renew it at Gandi. Already on Cloudflare? Then ignore this.',
  },
  {
    date: '2027-09-15',
    text: '⚠️ maasflowrecords.com expires at Gandi in 7 days (22 Sep 2027)! Renew or move it to Cloudflare now, or the website goes offline. Already on Cloudflare? Then ignore this.',
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
