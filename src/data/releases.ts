import type { Release } from './types';
import { cleanLinks, list, opt, slugFromPath } from './clean';

/**
 * Releases — edited in the admin panel (/admin → Releases) or in src/content/releases/*.json.
 * The Music page and home page show only label releases;
 * an artist's page shows all of that artist's releases here.
 * Older music is reachable through the streaming links on the artist page.
 *
 * - `label: false`: released before the label → artist page only, no catalogue number.
 * - `releaseDate`: 'YYYY-MM-DD'. Leave it out while the date is not announced (shows "TBA").
 *   A future date or no date = shown as "Upcoming".
 * - Covers go in /public/images/releases/ (square, 1000x1000 or larger).
 * - `preview`: a short .mp3 clip in /public/audio/ (see README).
 */
type RawRelease = {
  title: string;
  artists?: string[];
  type: Release['type'];
  releaseDate?: string;
  dateTentative?: boolean;
  label?: boolean;
  cover: string;
  description?: string;
  tracks?: string[];
  credits?: string;
  links?: Record<string, unknown>;
  preview?: string;
};

// One JSON file per release in src/content/releases/ (the file name is the URL slug).
const files = import.meta.glob<RawRelease>('../content/releases/*.json', { eager: true, import: 'default' });

export const releases: Release[] = Object.entries(files).map(([path, r]) => ({
  slug: slugFromPath(path),
  title: r.title,
  artists: list(r.artists).length ? list(r.artists) : ['vin'],
  type: r.type,
  releaseDate: opt(r.releaseDate)?.slice(0, 10),
  dateTentative: r.dateTentative === true,
  label: r.label !== false,
  cover: r.cover,
  description: r.description ?? '',
  tracks: list(r.tracks).length ? list(r.tracks) : undefined,
  credits: opt(r.credits),
  links: cleanLinks(r.links),
  preview: opt(r.preview),
}));

const today = () => new Date().toISOString().slice(0, 10);

/** Sort key: releases without a date (TBA) count as the furthest in the future. */
const dateKey = (r: Release) => r.releaseDate ?? '9999-12-31';

export const isUpcoming = (r: Release) => !r.releaseDate || r.releaseDate > today();

export const sortedReleases = () => [...releases].sort((a, b) => dateKey(b).localeCompare(dateKey(a)));

export const isLabelRelease = (r: Release) => r.label !== false;

/** The Maas Flow Records catalogue (newest first). */
export const labelReleases = () => sortedReleases().filter(isLabelRelease);

export const latestRelease = () => labelReleases().find((r) => !isUpcoming(r));

export const upcomingReleases = () => labelReleases().filter(isUpcoming).reverse();

export const releasesByArtist = (slug: string) => sortedReleases().filter((r) => r.artists.includes(slug));
