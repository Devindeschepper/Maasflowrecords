import type { LabelEvent } from './types';
import { opt, slugFromPath } from './clean';

/**
 * Events — edited in the admin panel (/admin → Events) or in src/content/events/*.json.
 * Past / upcoming is decided automatically from the date. No date = "Date TBA";
 * no time = whole-day event. Event images: 16:9, e.g. 1600x900.
 */
type RawEvent = {
  title: string;
  kind: LabelEvent['kind'];
  date?: string; // YYYY-MM-DD, empty = TBA
  time?: string; // HH:mm, empty = all-day
  dateTentative?: boolean;
  venue?: string;
  city?: string;
  online?: boolean;
  description?: string;
  image: string;
  ticketUrl?: string;
  ticketLabel?: string;
};

/** "2026-11-27" + "20:00" → "2026-11-27T20:00:00+01:00" (Amsterdam time, summer/winter aware). */
function toIso(date: string, time: string) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset =
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', timeZoneName: 'longOffset' })
      .formatToParts(guess)
      .find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', '') || '+00:00';
  return `${date}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00${offset === '' ? '+00:00' : offset}`;
}

// One JSON file per event in src/content/events/ (the file name is the slug).
const files = import.meta.glob<RawEvent>('../content/events/*.json', { eager: true, import: 'default' });

export const events: LabelEvent[] = Object.entries(files).map(([path, e]) => {
  const date = opt(e.date)?.slice(0, 10);
  const time = opt(e.time);
  return {
    slug: slugFromPath(path),
    title: e.title,
    kind: e.kind,
    start: date ? toIso(date, time ?? '00:00') : undefined,
    allDay: !time,
    dateTentative: e.dateTentative === true,
    venue: e.venue ?? '',
    city: e.city ?? '',
    online: e.online === true,
    description: e.description ?? '',
    image: e.image,
    ticketUrl: opt(e.ticketUrl),
    ticketLabel: opt(e.ticketLabel),
  };
});

export const isPast = (e: LabelEvent) => !!e.start && new Date(e.start).getTime() < Date.now();

/** Upcoming: dated events first (soonest first), then events without a date. */
export const upcomingEvents = () =>
  events
    .filter((e) => !isPast(e))
    .sort((a, b) => (a.start ?? '9999').localeCompare(b.start ?? '9999'));

export const pastEvents = () =>
  events.filter(isPast).sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''));
