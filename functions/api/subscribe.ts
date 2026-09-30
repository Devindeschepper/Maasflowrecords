import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail } from '../_lib/mail';

/**
 * Newsletter signup. Adds the email to a Resend Audience when RESEND_AUDIENCE_ID
 * is set (https://resend.com/docs/api-reference/contacts/create-contact);
 * otherwise the signup is emailed to the label so nobody gets lost.
 */
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

  const email = str(fd, 'email', 200).toLowerCase();
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (str(fd, 'consent', 5) !== 'yes') return reply(request, 400, { ok: false, error: 'Please tick the box to agree to receive emails.' });

  try {
    if (env.RESEND_AUDIENCE_ID && env.RESEND_API_KEY) {
      const res = await fetch(`https://api.resend.com/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      // 409 / "already exists" is fine: they're on the list.
      if (!res.ok && res.status !== 409) {
        console.error('Resend contacts error', res.status, await res.text().catch(() => ''));
        throw new Error('Could not add contact.');
      }
    } else {
      await sendMail(env, {
        subject: `[Newsletter] New signup: ${email}`,
        fields: [
          ['Email', email],
          ['Consent', `Agreed to receive emails on ${new Date().toISOString()}`],
          ['Note', 'Add this address to your mailing list (set RESEND_AUDIENCE_ID to do this automatically).'],
        ],
      });
    }
  } catch (err) {
    console.error(err);
    return reply(request, 502, { ok: false, error: 'Signing up failed right now.' });
  }

  return reply(request, 200, { ok: true });
};
