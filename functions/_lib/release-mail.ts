import type { Env } from './env';
import { escapeHtml } from './http';
import { contactList } from './newsletter';
import { hmacHex, safeEqual } from './sign';
import { luxParts } from './studio';
import { notifyWhatsApp } from './whatsapp';
import type { ReleaseDate } from './anniversary';
import { site } from '../../src/data/site';

/**
 * Automatic newsletter: on a label release's release day (from 10:00 Luxembourg time), everyone on the
 * newsletter list gets one email about it. Releases added in /admin are picked up by themselves.
 * - The first run only remembers the releases that are already out, so nobody gets emails about old songs.
 * - A release whose date is more than 7 days ago when it's first seen is skipped (added late).
 * - Sent with the Resend batch API, 100 per call, at most 5 calls per hourly run; the rest goes the next
 *   hour (KV 'release-mail-<slug>' = how many are done).
 * - Every email has an unsubscribe link (signed, so nobody can unsubscribe someone else).
 * VIN gets one WhatsApp when it's sent.
 */
const BATCH = 100;
const BATCHES_PER_RUN = 5;
const MAX_AGE = 7 * 24 * 3600 * 1000;

/** Secret for the unsubscribe links: made once and kept in KV, so there's nothing to set up. */
async function unsubSecret(env: Env): Promise<string> {
  let secret = await env.STUDIO!.get('unsub-secret');
  if (!secret) {
    secret = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.STUDIO!.put('unsub-secret', secret);
  }
  return secret;
}

export async function unsubscribeLink(env: Env, email: string): Promise<string> {
  const t = (await hmacHex('SHA-256', await unsubSecret(env), email.toLowerCase())).slice(0, 32);
  return `${site.url}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${t}`;
}

export async function validUnsubscribe(env: Env, email: string, token: string): Promise<boolean> {
  if (!env.STUDIO || !email || !token) return false;
  const t = (await hmacHex('SHA-256', await unsubSecret(env), email.toLowerCase())).slice(0, 32);
  return safeEqual(t, token);
}

async function releaseEmail(env: Env, to: string, r: ReleaseDate) {
  const url = `${site.url}/music/${r.slug}/`;
  const unsub = await unsubscribeLink(env, to);
  const what = r.type === 'Single' ? 'single' : r.type === 'Album' ? 'album' : r.type === 'EP' ? 'EP' : 'beat tape';
  const lines = [`Hi,`, `The new ${what} "${r.title}" is out now on all platforms.`, `Listen here: ${url}`, 'Thanks for the support.', 'Maas Flow Records'];
  const p = (s: string) => `<p style="font-family:sans-serif;line-height:1.5">${escapeHtml(s).replace(escapeHtml(url), `<a href="${url}">${url}</a>`)}</p>`;
  return {
    from: env.CONTACT_FROM_EMAIL!,
    to: [to],
    reply_to: env.CONTACT_TO_EMAIL ?? site.email,
    subject: `Out now: ${r.title} - Maas Flow Records`.replace(/[\r\n]+/g, ' ').slice(0, 200),
    html:
      lines.map(p).join('') +
      `<p style="font-family:sans-serif;font-size:12px;color:#777">You get this because you joined the Maas Flow Records newsletter. <a href="${unsub}">Unsubscribe</a></p>`,
    text: `${lines.join('\n\n')}\n\nUnsubscribe: ${unsub}`,
    headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}

/** Hourly cron. Never throws. */
export async function releaseNewsletter(env: Env, now: number, load: () => Promise<(ReleaseDate & { label?: boolean })[]>): Promise<void> {
  try {
    if (!env.STUDIO || !env.RESEND_API_KEY?.trim() || !env.CONTACT_FROM_EMAIL) return;
    const p = luxParts(now);
    const today = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    const out = (await load()).filter((r) => r.label !== false && r.date <= today);
    const saved = await env.STUDIO.get('release-mail-done');
    const done = new Set<string>(JSON.parse(saved ?? '[]') as string[]);
    const remember = () => env.STUDIO!.put('release-mail-done', JSON.stringify([...done]));
    if (saved === null) {
      out.forEach((r) => done.add(r.slug)); // first run: the releases already out are not news
      return void (await remember());
    }
    const r = out.find((x) => !done.has(x.slug));
    if (!r) return;
    if (now - Date.parse(`${r.date}T12:00:00Z`) > MAX_AGE) {
      done.add(r.slug);
      return void (await remember());
    }
    if (r.date === today && p.hour < 10) return; // release day: from 10:00, not in the night

    const list = (await contactList(env)).map((c) => c.email).filter(Boolean);
    const progressKey = `release-mail-${r.slug}`;
    let sent = Number((await env.STUDIO.get(progressKey)) ?? 0);
    for (let i = 0; i < BATCHES_PER_RUN && sent < list.length; i++) {
      const batch = list.slice(sent, sent + BATCH);
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(await Promise.all(batch.map((to) => releaseEmail(env, to, r)))),
      });
      if (!res.ok) {
        console.error('Release newsletter failed', res.status, await res.text().catch(() => ''));
        break; // try the rest again next hour
      }
      sent += batch.length;
      await env.STUDIO.put(progressKey, String(sent));
    }
    if (sent < list.length) return;
    done.add(r.slug);
    await remember();
    await env.STUDIO.delete(progressKey);
    if (sent) await notifyWhatsApp(env, `📧 Newsletter sent: "${r.title}" is out, ${sent} fan${sent === 1 ? '' : 's'} got the email.`);
  } catch (err) {
    console.error('Release newsletter failed', err);
  }
}
