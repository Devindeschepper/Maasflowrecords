import type { LabelEvent } from './types';

/**
 * Events. Past / upcoming is decided automatically from `start`.
 * Leave `start` out while there is no date yet — the event shows "Date TBA".
 * Event images go in /public/images/events/ (16:9, e.g. 1600x900).
 */
export const events: LabelEvent[] = [
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
    slug: '2real4u-release-party',
    title: '2Real4U — Release Party',
    kind: 'Label event',
    venue: 'Location TBA',
    city: '',
    description: 'A night to celebrate the release of the 2Real4U EP. Date and location will be announced soon.',
    image: '/images/releases/2real4u.svg',
  },
  {
    slug: 'studio-session',
    title: 'Studio Session',
    kind: 'Livestream',
    venue: 'Online',
    city: '',
    online: true,
    description: 'VIN in the studio, live — making beats and working on new music. Date will be announced on socials.',
    image: '/images/events/event-live.svg',
  },
];

export const isPast = (e: LabelEvent) => !!e.start && new Date(e.start).getTime() < Date.now();

/** Upcoming: dated events first (soonest first), then events without a date. */
export const upcomingEvents = () =>
  events
    .filter((e) => !isPast(e))
    .sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999'));

export const pastEvents = () =>
  events.filter(isPast).sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
