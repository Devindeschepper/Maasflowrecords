import type { Env } from './env';
import { oneLine } from './http';

/**
 * Sends a short WhatsApp message to the label's own phone via CallMeBot
 * (https://www.callmebot.com/blog/free-api-whatsapp-messages/).
 * Only for notifications to ourselves: the message says what came in, the details stay in the email.
 * Does nothing when WHATSAPP_PHONE / CALLMEBOT_API_KEY are not set, and never throws:
 * a failed WhatsApp ping must not break a form or an order.
 */
export async function notifyWhatsApp(env: Env, text: string): Promise<void> {
  const phone = env.WHATSAPP_PHONE?.replace(/[^\d+]/g, '');
  const apikey = env.CALLMEBOT_API_KEY?.trim();
  if (!phone || !apikey) return;

  const url = new URL('https://api.callmebot.com/whatsapp.php');
  url.searchParams.set('phone', phone);
  url.searchParams.set('text', text.slice(0, 600));
  url.searchParams.set('apikey', apikey);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) console.error('WhatsApp notification failed', res.status);
  } catch (err) {
    console.error('WhatsApp notification failed', err);
  }
}

/** The WhatsApp text for a label email: the subject plus who sent it. */
export function whatsAppSummary(subject: string, fields: [string, string][]): string {
  const pick = (k: string) => fields.find(([key]) => key.toLowerCase() === k)?.[1];
  const who = pick('name') || pick('email');
  return ['🔴 Maas Flow Records', oneLine(subject), who ? `From: ${oneLine(who).slice(0, 100)}` : '', 'Details in your email.']
    .filter(Boolean)
    .join('\n');
}
