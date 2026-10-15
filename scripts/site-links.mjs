// Writes dist/site-links.json after `astro build`: every outside link on the website (streaming, socials,
// BeatStars …) and the first page it appears on. The worker checks them once a month and sends a WhatsApp
// only when one is broken (functions/_lib/linkcheck.ts).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist', import.meta.url).pathname;
const pages = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && pages.push(p); });
walk(dist);

const links = new Map();
for (const p of pages.sort()) {
  const page = '/' + relative(dist, p).replace(/index\.html$/, '');
  if (page.startsWith('/admin')) continue;
  for (const [, href] of readFileSync(p, 'utf8').matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^"]+)"/g)) {
    const url = href.replace(/&amp;/g, '&');
    if (/^https?:\/\/(www\.)?maasflowrecords\.com/i.test(url) || links.has(url)) continue;
    links.set(url, page);
  }
}
const list = [...links].map(([url, page]) => ({ url, page })).sort((a, b) => a.url.localeCompare(b.url));
writeFileSync(join(dist, 'site-links.json'), JSON.stringify(list));
console.log(`site-links: ${list.length} outside links`);
