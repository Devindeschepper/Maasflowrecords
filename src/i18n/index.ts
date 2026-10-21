/**
 * Languages: English (default, no prefix), French (/fr/…) and German (/de/…).
 * The page texts are translated in each page/component (a `pick(lang, { en, fr, de })` block next to the HTML),
 * shared bits (menu, buttons, footer) live in ui.ts. Content from the admin panel (bios, release and product
 * descriptions) stays as written there.
 */
export type Lang = 'en' | 'fr' | 'de';
export const LANGS: Lang[] = ['en', 'fr', 'de'];
export const LANG_LABELS: Record<Lang, string> = { en: 'English', fr: 'Français', de: 'Deutsch' };
/** For dates and numbers. */
export const LOCALES: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE' };

/** The /fr/ and /de/ versions of these pages exist (see src/pages/[lang]/). */
const TRANSLATED = new Set(['', 'artists', 'bio', 'music', 'events', 'services', 'shop', 'cart', 'order', 'thanks', 'casting', 'contact', 'press', 'links']);

export const langFromPath = (path: string): Lang => (path.match(/^\/(fr|de)(?=\/|$)/)?.[1] as Lang | undefined) ?? 'en';
/** The language of the page being built (from its URL). */
export const getLang = (astro: { url: URL }): Lang => langFromPath(astro.url.pathname);

/** '/fr/shop/' → '/shop/' */
export const stripLang = (path: string) => path.replace(/^\/(fr|de)(?=\/|$)/, '') || '/';

/** An internal link in the given language: '/shop/' → '/fr/shop/'. Other links (files, admin, outside) unchanged. */
export function localize(href: string, lang: Lang): string {
  if (lang === 'en' || !href.startsWith('/') || href.startsWith('//')) return href;
  if (/\.[a-z0-9]{2,5}([?#]|$)/i.test(href.split(/[?#]/)[0])) return href; // a file (zip, png…)
  const first = href.slice(1).split(/[/?#]/)[0];
  if (!TRANSLATED.has(first)) return href;
  return `/${lang}${href === '/' ? '/' : href.startsWith('/#') ? `/${href.slice(1)}` : href}`;
}

/** The same page in another language. */
export const switchLang = (path: string, to: Lang) => localize(stripLang(path), to);

/** Picks the texts for the page's language; TypeScript checks that every language has the same keys. */
export const pick = <T>(lang: Lang, texts: { en: T; fr: T; de: T }): T => texts[lang];
