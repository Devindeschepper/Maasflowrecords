import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail } from '../_lib/mail';

// Keep in sync with src/pages/contact.astro
const TOPICS: Record<string, string> = {
  general: 'General',
  artists: 'Artists',
  beats: 'Beats & production',
  business: 'Business',
  events: 'Events & booking',
  press: 'Press',
  shop: 'Shop & orders',
};

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
  const topicKey = str(fd, 'topic', 30);
  const subject = str(fd, 'subject', 150);
  const message = str(fd, 'message', 5000);
  const topic = TOPICS[topicKey] ?? 'General';

  if (!name || !subject || !message) return reply(request, 400, { ok: false, error: 'Please fill in all required fields.' });
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });

  try {
    await sendMail(env, {
      subject: `[Contact · ${topic}] ${subject}`,
      replyTo: email,
      fields: [
        ['Topic', topic],
        ['Name', name],
        ['Email', email],
        ['Subject', subject],
        ['Message', message],
      ],
    });
  } catch (err) {
    console.error(err);
    return reply(request, 502, { ok: false, error: 'Your message could not be sent right now.' });
  }

  return reply(request, 200, { ok: true });
};
