import type { Release } from './types';

/**
 * Discography. Newest release first is not required — pages sort by date.
 * A release with a future `releaseDate` is automatically shown as "Upcoming".
 *
 * TODO: the entries below are PLACEHOLDERS so the site can be tested.
 * Replace them with VIN's real releases (title, date, cover, links).
 * Covers go in /public/images/releases/ (square, at least 1000x1000, .jpg or .webp).
 */
export const releases: Release[] = [
  {
    slug: 'behind-the-mic',
    title: 'Behind The Mic',
    artists: ['vin'],
    type: 'EP',
    releaseDate: '2026-11-20',
    cover: '/images/releases/cover-2.svg',
    description:
      'The first EP on Maas Flow Records. Produced, written and recorded by VIN — five years of learning, in one project.',
    tracks: ['Intro', 'Rotterdam Nights', 'Student Of The Game', 'What I Live', 'Outro'],
    links: {},
    featured: true,
  },
  {
    slug: 'what-i-live',
    title: 'What I Live',
    artists: ['vin'],
    type: 'Single',
    releaseDate: '2026-06-12',
    cover: '/images/releases/cover-1.svg',
    description: 'I rap what I live. A single about the people and the situations that shaped VIN.',
    links: {
      spotify: '',
      appleMusic: '',
      youtube: '',
      soundcloud: '',
    },
    // Example: preview: '/audio/what-i-live.mp3',
  },
  {
    slug: 'student-of-the-game',
    title: 'Student Of The Game',
    artists: ['vin'],
    type: 'Single',
    releaseDate: '2026-03-06',
    cover: '/images/releases/cover-3.svg',
    description: 'Still learning. Production, flow, delivery — a single about the process.',
    links: {
      spotify: '',
      appleMusic: '',
      youtube: '',
    },
  },
  {
    slug: 'maas-tapes-vol-1',
    title: 'Maas Tapes Vol. 1',
    artists: ['vin'],
    type: 'Beat Tape',
    releaseDate: '2025-10-10',
    cover: '/images/releases/cover-4.svg',
    description: 'Instrumentals from the early years behind the beats. Leases available on BeatStars.',
    links: {
      beatstars: '',
      soundcloud: '',
    },
  },
];

const today = () => new Date().toISOString().slice(0, 10);

export const isUpcoming = (r: Release) => r.releaseDate > today();

export const sortedReleases = () =>
  [...releases].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

export const latestRelease = () => sortedReleases().find((r) => !isUpcoming(r));

export const upcomingReleases = () =>
  sortedReleases()
    .filter(isUpcoming)
    .reverse();

export const releasesByArtist = (slug: string) =>
  sortedReleases().filter((r) => r.artists.includes(slug));
