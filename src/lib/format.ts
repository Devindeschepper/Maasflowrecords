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

export const artistNames = (r: Release) =>
  r.artists.map((slug) => artists.find((a) => a.slug === slug)?.name ?? slug).join(' & ');

/** Catalogue number, e.g. MFR-003 — assigned by release date (oldest = 001). */
export const catalogNo = (r: Release) => {
  const ordered = [...releases].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  return `MFR-${String(ordered.indexOf(r) + 1).padStart(3, '0')}`;
};
