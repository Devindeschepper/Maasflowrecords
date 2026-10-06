import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail } from '../_lib/mail';

/**
 * Newsletter signup. Adds the email to the Resend contact list (or to the audience
 * in RESEND_AUDIENCE_ID, if set); if that fails, the signup is emailed to the label
 * so nobody gets lost.
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

  // 1. Save the contact in Resend: the account-wide contact list, or a specific
  //    (legacy) audience when RESEND_AUDIENCE_ID is set.
  // 2. If that fails (no key, key without contact access, API change), email the
  //    signup to the label instead, so nobody is lost.
  let saved = false;
  if (env.RESEND_API_KEY) {
    const url = env.RESEND_AUDIENCE_ID
      ? `https://api.resend.com/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`
      : 'https://api.resend.com/contacts';
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, unsubscribed: false }),
      });
      // 409 / "already exists" is fine: they're on the list.
      saved = res.ok || res.status === 409;
      if (!saved) console.error('Resend contacts error', res.status, await res.text().catch(() => ''));
    } catch (err) {
      console.error('Resend contacts request failed', err);
    }
  }

  if (!saved) {
    try {
      await sendMail(env, {
        subject: `[Newsletter] New signup: ${email}`,
        fields: [
          ['Email', email],
          ['Consent', `Agreed to receive emails on ${new Date().toISOString()}`],
          ['Note', 'Could not save this address in Resend automatically — add it to the contact list by hand.'],
        ],
      });
    } catch (err) {
      console.error(err);
      return reply(request, 502, { ok: false, error: 'Signing up failed right now.' });
    }
  }

  return reply(request, 200, { ok: true });
};
