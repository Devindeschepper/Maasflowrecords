import type { LabelEvent } from './types';

/**
 * Events. Past / upcoming is decided automatically from `start`.
 * TODO: the entries below are PLACEHOLDERS — replace with real dates.
 * Event images go in /public/images/events/ (16:9, e.g. 1600x900).
 */
export const events: LabelEvent[] = [
  {
    slug: 'studio-livestream-oct-2026',
    title: 'Studio Session — Live Beat Making',
    kind: 'Livestream',
    start: '2026-10-24T21:00:00+02:00',
    venue: 'Online',
    city: 'YouTube / Instagram Live',
    online: true,
    description:
      'VIN builds a beat from scratch, live from the studio. Ask questions in the chat about production, mixing and the process.',
    image: '/images/events/event-live.svg',
    ticketUrl: '',
    ticketLabel: 'Watch live',
  },
  {
    slug: '2real4u-ep-release',
    title: '2Real4U — EP coming soon',
    kind: 'Release',
    start: '2026-11-27T00:00:00+01:00',
    allDay: true,
    dateTentative: true, // remove once the date is confirmed
    venue: 'All streaming platforms',
    city: '',
    online: true,
    description: 'The debut EP from VIN on Maas Flow Records. Run It Back and Not Enough are already out — two more songs are on the way.',
    image: '/images/releases/2real4u.svg',
    ticketUrl: '/music/2real4u/',
    ticketLabel: 'About the EP',
  },
  {
    slug: 'listening-session-may-2026',
    title: 'Private Listening Session',
    kind: 'Listening session',
    start: '2026-05-16T19:00:00+02:00',
    venue: 'Maas Flow Studio',
    city: 'Rotterdam, NL',
    description: 'First listen of new records with friends, family and supporters.',
    image: '/images/events/event-session.svg',
  },
];

export const isPast = (e: LabelEvent) => new Date(e.start).getTime() < Date.now();

export const upcomingEvents = () =>
  events.filter((e) => !isPast(e)).sort((a, b) => a.start.localeCompare(b.start));

export const pastEvents = () =>
  events.filter(isPast).sort((a, b) => b.start.localeCompare(a.start));
