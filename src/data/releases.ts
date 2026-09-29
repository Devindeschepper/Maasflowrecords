import type { Release } from './types';

/**
 * Maas Flow Records catalogue. Only releases on the label go here —
 * older music is reachable through the streaming links on VIN's page.
 *
 * - `releaseDate`: 'YYYY-MM-DD'. Leave it out while the date is not announced (shows "TBA").
 *   A future date or no date = shown as "Upcoming".
 * - Covers go in /public/images/releases/ (square, 1000x1000 or larger).
 * - `preview`: a short .mp3 clip in /public/audio/ (see README).
 */
export const releases: Release[] = [
  {
    slug: '2real4u',
    title: '2Real4U',
    artists: ['vin'],
    type: 'EP',
    releaseDate: '2026-11-27',
    dateTentative: true, // remove this line once the date is confirmed
    cover: '/images/releases/2real4u.svg', // TODO: replace with the final EP cover
    description: 'The debut EP from VIN on Maas Flow Records. Run It Back and Not Enough are out now — two more songs are on the way.',
    tracks: ['Run It Back', 'Not Enough', 'Coming soon', 'Coming soon'],
    links: {},
  },
  {
    slug: 'not-enough',
    title: 'Not Enough',
    artists: ['vin'],
    type: 'Single',
    releaseDate: '2026-06-19',
    cover: '/images/releases/2real4u.svg', // TODO: replace with the final cover
    description: 'Single from the upcoming 2Real4U EP.',
    links: { spotify: 'https://open.spotify.com/track/2ukplGX06n0amTGPO4Tjxl' },
    preview: '/audio/not-enough.mp3',
  },
  {
    slug: 'run-it-back',
    title: 'Run It Back',
    artists: ['vin'],
    type: 'Single',
    releaseDate: '2026-04-30',
    cover: '/images/releases/2real4u.svg', // TODO: replace with the final cover
    description: 'Single from the upcoming 2Real4U EP.',
    links: { spotify: 'https://open.spotify.com/track/19zx4FNvRzGTegy8hOZE60' },
    preview: '/audio/run-it-back.mp3',
  },
  {
    slug: 'take-your-time',
    title: 'Take Your Time',
    artists: ['vin'],
    type: 'Single',
    releaseDate: '2025-08-15',
    cover: '/images/releases/take-your-time.jpg',
    description: 'Single by VIN.',
    links: { spotify: 'https://open.spotify.com/track/4xO0Wf7CMtQFVbuNOHQT4R' },
    preview: '/audio/take-your-time.mp3',
  },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Sort key: releases without a date (TBA) count as the furthest in the future. */
const dateKey = (r: Release) => r.releaseDate ?? '9999-12-31';

export const isUpcoming = (r: Release) => !r.releaseDate || r.releaseDate > today();

export const sortedReleases = () => [...releases].sort((a, b) => dateKey(b).localeCompare(dateKey(a)));

export const latestRelease = () => sortedReleases().find((r) => !isUpcoming(r));

export const upcomingReleases = () => sortedReleases().filter(isUpcoming).reverse();

export const releasesByArtist = (slug: string) => sortedReleases().filter((r) => r.artists.includes(slug));
