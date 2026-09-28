import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { sendMail, fileToAttachment, type Attachment } from '../_lib/mail';

// Keep in sync with src/pages/casting.astro
const ROLES = [
  'Singer', 'Rapper', 'Producer', 'Guitarist', 'Pianist', 'Drummer', 'Bassist',
  'DJ', 'Songwriter', 'Mixing engineer', 'Mastering engineer', 'Other',
];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(mp3|wav|m4a|pdf|zip)$/i;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return reply(request, 403, { ok: false, error: 'Forbidden.' });

  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_FILE_BYTES + 200_000) {
    return reply(request, 413, { ok: false, error: 'Upload too large (max 10 MB). Please share a link instead.' });
  }

  let fd: FormData;
  try {
    fd = await request.formData();
  } catch {
    return reply(request, 400, { ok: false, error: 'Invalid form data.' });
  }

  const spam = await checkSpam(request, fd, env);
  if (spam) return reply(request, 400, { ok: false, error: spam });

  const name = str(fd, 'name', 100);
  const stageName = str(fd, 'stageName', 100);
  const email = str(fd, 'email', 200);
  const role = str(fd, 'role', 40);
  const genre = str(fd, 'genre', 100);
  const location = str(fd, 'location', 100);
  const socials = str(fd, 'socials', 1000);
  const portfolio = str(fd, 'portfolio', 1500);
  const message = str(fd, 'message', 3000);
  const consent = str(fd, 'consent', 5) === 'yes';

  if (!name || !portfolio || !message) return reply(request, 400, { ok: false, error: 'Please fill in all required fields.' });
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });
  if (!ROLES.includes(role)) return reply(request, 400, { ok: false, error: 'Please choose your role.' });
  if (!consent) return reply(request, 400, { ok: false, error: 'Please accept the privacy consent.' });

  const attachments: Attachment[] = [];
  const file = fd.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_BYTES) return reply(request, 413, { ok: false, error: 'File too large (max 10 MB).' });
    if (!ALLOWED_EXT.test(file.name)) return reply(request, 400, { ok: false, error: 'Allowed file types: MP3, WAV, M4A, PDF, ZIP.' });
    attachments.push(await fileToAttachment(file));
  }

  try {
    await sendMail(env, {
      subject: `[Casting · ${role}] ${stageName || name}`,
      replyTo: email,
      fields: [
        ['Name', name],
        ['Artist / stage name', stageName],
        ['Email', email],
        ['Role', role],
        ['Genre', genre],
        ['Location', location],
        ['Socials', socials],
        ['Music / portfolio', portfolio],
        ['Message', message],
        ['Attachment', attachments[0]?.filename ?? ''],
      ],
      attachments,
    });
  } catch (err) {
    console.error(err);
    return reply(request, 502, { ok: false, error: 'Your submission could not be sent right now.' });
  }

  return reply(request, 200, { ok: true });
};
