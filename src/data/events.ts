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
    slug: '2real4u-release-show',
    title: '2Real4U — Release Show',
    kind: 'Concert',
    start: '2026-12-12T20:00:00+01:00',
    venue: 'Venue TBA',
    city: 'Rotterdam, NL',
    description:
      'The release show for the first Maas Flow Records EP. VIN performs the project live, with support from local artists.',
    image: '/images/events/event-show.svg',
    ticketUrl: '',
    ticketLabel: 'Tickets',
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
