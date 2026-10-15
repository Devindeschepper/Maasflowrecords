import type { Env } from './env';
import { notifyWhatsApp } from './whatsapp';

/**
 * Monthly link check (cron on the 1st, with the monthly report): opens every outside link on the website
 * (from /site-links.json, see scripts/site-links.mjs) and sends one WhatsApp only when some are broken.
 * Only "not found" answers count (404/410, or a site that doesn't exist): Instagram, TikTok and co. often
 * block robots with 403/429, which says nothing about the link. A link must fail twice to count.
 */
export interface SiteLink {
  url: string;
  page: string;
}

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function isBroken(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(10000) });
    await res.body?.cancel();
    return res.status === 404 || res.status === 410 ? String(res.status) : null;
  } catch (err) {
    // A site that no longer exists; a timeout alone is not enough.
    return /ENOTFOUND|getaddrinfo|DNS|could not resolve/i.test(String(err)) ? 'site not found' : null;
  }
}

export async function brokenLinks(links: SiteLink[]): Promise<(SiteLink & { why: string })[]> {
  const out: (SiteLink & { why: string })[] = [];
  for (const link of links.slice(0, 40)) {
    const why = await isBroken(link.url);
    if (why && (await isBroken(link.url))) out.push({ ...link, why });
  }
  return out;
}

export function linkCheckText(broken: (SiteLink & { why: string })[]): string {
  if (!broken.length) return '';
  const short = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70);
  return [
    '🔴 Maas Flow Records',
    `🔗 ${broken.length === 1 ? 'A link on your website is' : `${broken.length} links on your website are`} broken:`,
    ...broken.map((b) => `• ${short(b.url)} (${b.why}) on ${b.page === '/' ? 'Home' : b.page}`),
    'Fix it in the admin panel (maasflowrecords.com/admin).',
  ].join('\n');
}

export async function monthlyLinkCheck(env: Env, load: () => Promise<SiteLink[]>): Promise<void> {
  try {
    const text = linkCheckText(await brokenLinks(await load()));
    if (text) await notifyWhatsApp(env, text);
  } catch (err) {
    console.error('Link check failed', err);
  }
}
