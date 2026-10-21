import { artists } from '../data/artists';
import { releases } from '../data/releases';
import type { LabelEvent, Release } from '../data/types';
import { LOCALES, pick, type Lang } from '../i18n';

const TZ = 'Europe/Amsterdam';

export const fmtDate = (iso: string, lang: Lang = 'en') =>
  new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso));

export const fmtEventDate = (iso: string, lang: Lang = 'en') => {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(LOCALES[lang], { ...o, timeZone: TZ }).format(d);
  return {
    day: f({ day: '2-digit' }),
    month: f({ month: 'short' }).replace(/\.$/, ''),
    year: f({ year: 'numeric' }),
    weekday: f({ weekday: 'long' }),
    time: f({ hour: '2-digit', minute: '2-digit' }),
    full: f({ dateStyle: 'full' }),
  };
};

const words = (lang: Lang) =>
  pick(lang, {
    en: { expected: 'Expected ', soon: 'Coming soon', out: 'Out ' },
    fr: { expected: 'Prévu le ', soon: 'Bientôt', out: 'Sortie le ' },
    de: { expected: 'Geplant: ', soon: 'Demnächst', out: 'Erscheint am ' },
  });

/** Release date for display, or "Coming soon" when not announced yet. */
export const releaseDateLabel = (r: Release, lang: Lang = 'en') =>
  r.releaseDate ? `${r.dateTentative ? words(lang).expected : ''}${fmtDate(r.releaseDate, lang)}` : words(lang).soon;

/** "Out 14 Nov 2026" for a confirmed upcoming date, otherwise the same as releaseDateLabel. */
export const outLabel = (r: Release, lang: Lang = 'en') =>
  `${r.releaseDate && !r.dateTentative ? words(lang).out : ''}${releaseDateLabel(r, lang)}`;

const KINDS: Record<Exclude<Lang, 'en'>, Record<LabelEvent['kind'], string>> = {
  fr: { Release: 'Sortie', Concert: 'Concert', Livestream: 'Live', Performance: 'Performance', 'Label event': 'Événement du label', 'Listening session': "Session d'écoute", Other: 'Autre' },
  de: { Release: 'Release', Concert: 'Konzert', Livestream: 'Livestream', Performance: 'Auftritt', 'Label event': 'Label-Event', 'Listening session': 'Listening Session', Other: 'Sonstiges' },
};
export const kindLabel = (kind: LabelEvent['kind'], lang: Lang = 'en') => (lang === 'en' ? kind : KINDS[lang][kind] ?? kind);

export const artistNames = (r: Release) =>
  r.artists.map((slug) => artists.find((a) => a.slug === slug)?.name ?? slug).join(' & ');

/**
 * Catalogue number, e.g. MFR-003 — label releases only, assigned by release date (oldest = 001).
 * Returns '' for releases outside the label.
 */
export const catalogNo = (r: Release) => {
  if (r.label === false) return '';
  const key = (x: Release) => x.releaseDate ?? '9999-12-31';
  const ordered = releases.filter((x) => x.label !== false).sort((a, b) => key(a).localeCompare(key(b)));
  return `MFR-${String(ordered.indexOf(r) + 1).padStart(3, '0')}`;
};

/** "MFR-002 · Single", or just "Single" outside the label. */
export const releaseMeta = (r: Release) => [catalogNo(r), r.type].filter(Boolean).join(' · ');
