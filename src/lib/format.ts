import { artists } from '../data/artists';
import { releases } from '../data/releases';
import type { Release } from '../data/types';

const TZ = 'Europe/Amsterdam';

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(iso));

export const fmtEventDate = (iso: string) => {
  const d = new Date(iso);
  return {
    day: new Intl.DateTimeFormat('en-GB', { day: '2-digit', timeZone: TZ }).format(d),
    month: new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: TZ }).format(d),
    year: new Intl.DateTimeFormat('en-GB', { year: 'numeric', timeZone: TZ }).format(d),
    weekday: new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: TZ }).format(d),
    time: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d),
    full: new Intl.DateTimeFormat('en-GB', { dateStyle: 'full', timeZone: TZ }).format(d),
  };
};

/** Release date for display, or "TBA" when not announced yet. */
export const releaseDateLabel = (r: Release) => (r.releaseDate ? `${r.dateTentative ? 'Expected ' : ''}${fmtDate(r.releaseDate)}` : 'TBA');

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
