import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail } from '../_lib/mail';
import { requestTypes, mixing } from '../../src/data/services';

/** Mixing / mastering / custom beat request — emailed to the label. No payment on the site. */
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
  const artistName = str(fd, 'artistName', 100);
  const type = requestTypes.find((t) => t.value === str(fd, 'type', 40));
  const songs = str(fd, 'songs', 10);
  const stems = str(fd, 'stems', 60);
  const deadline = str(fd, 'deadline', 20);
  // Accept "wetransfer.com/…" without a scheme.
  const rawLink = str(fd, 'link', 500);
  const link = rawLink && !/^https?:\/\//i.test(rawLink) ? `https://${rawLink}` : rawLink;
  const message = str(fd, 'message', 4000);

  if (!name || !message) return reply(request, 400, { ok: false, error: 'Please fill in all required fields.' });
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (!type) return reply(request, 400, { ok: false, error: 'Please choose what you need.' });
  if (stems && !mixing.stemOptions.includes(stems)) return reply(request, 400, { ok: false, error: 'Please choose the number of stems.' });
  if (songs && !/^\d{1,3}$/.test(songs)) return reply(request, 400, { ok: false, error: 'Please enter the number of songs.' });
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return reply(request, 400, { ok: false, error: 'Please enter a valid date.' });
  if (link && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(link)) return reply(request, 400, { ok: false, error: 'Please paste a valid link (e.g. wetransfer.com/…).' });

  try {
    await sendMail(env, {
      subject: `[Services] ${type.label} · ${artistName || name}`,
      replyTo: email,
      fields: [
        ['Request', type.label],
        ['Number of songs', songs || '—'],
        ['Stems', stems || 'Not given'],
        ['Deadline', deadline || 'Flexible'],
        ['Files (stems / mix)', link],
        ['Name', name],
        ['Artist name', artistName],
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
