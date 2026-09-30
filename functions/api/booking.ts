import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail } from '../_lib/mail';
import { artists } from '../../src/data/artists';

// Keep in sync with src/components/BookingForm.astro
const EVENT_TYPES = ['Concert / show', 'Festival', 'Club night', 'Private event', 'Livestream', 'Other'];

/** Booking request for one of the label's artists — emailed to the label. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return reply(request, 403, { ok: false, error: 'Forbidden.' });

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return reply(request, 400, { ok: false, error: 'Invalid form data.' });
  }

  const spam = await checkSpam(request, fd, env);
  if (spam) return reply(request, 400, { ok: false, error: spam });

  const name = str(fd, 'name', 100);
  const email = str(fd, 'email', 200);
  const organisation = str(fd, 'organisation', 150);
  const artist = artists.find((a) => a.slug === str(fd, 'artist', 50));
  const eventType = str(fd, 'eventType', 40);
  const date = str(fd, 'date', 20);
  const location = str(fd, 'location', 150);
  const audience = str(fd, 'audience', 50);
  const budget = str(fd, 'budget', 80);
  const message = str(fd, 'message', 4000);

  if (!name || !location || !message) return reply(request, 400, { ok: false, error: 'Please fill in all required fields.' });
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (!artist) return reply(request, 400, { ok: false, error: 'Please choose an artist.' });
  if (!EVENT_TYPES.includes(eventType)) return reply(request, 400, { ok: false, error: 'Please choose the type of event.' });
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return reply(request, 400, { ok: false, error: 'Please enter a valid date.' });

  try {
    await sendMail(env, {
      subject: `[Booking · ${artist.name}] ${eventType}${date ? ` · ${date}` : ''} · ${location}`,
      replyTo: email,
      fields: [
        ['Artist', artist.name],
        ['Type of event', eventType],
        ['Date', date || 'Flexible / not set'],
        ['Location / venue', location],
        ['Expected audience', audience],
        ['Budget / fee', budget],
        ['Name', name],
        ['Organisation', organisation],
        ['Email', email],
        ['Message', message],
      ],
    });
  } catch (err) {
    console.error(err);
    return reply(request, 502, { ok: false, error: 'Your request could not be sent right now.' });
  }

  return reply(request, 200, { ok: true });
};
