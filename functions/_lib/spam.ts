import type { Env } from './env';

/**
 * Layered spam protection for every form:
 *  1. honeypot field ("website") must be empty
 *  2. form must not be submitted faster than a human can type
 *  3. Cloudflare Turnstile token must verify (when TURNSTILE_SECRET_KEY is set)
 * Returns an error message, or null if the submission looks human.
 */
export async function checkSpam(req: Request, fd: FormData, env: Env): Promise<string | null> {
  if (String(fd.get('website') ?? '') !== '') return 'Spam detected.';

  const ts = Number(fd.get('_ts'));
  if (Number.isFinite(ts) && ts > 0 && Date.now() - ts < 2500) return 'Please take a moment before submitting.';

  if (!env.TURNSTILE_SECRET_KEY) return null; // not configured (local development)

  const token = String(fd.get('cf-turnstile-response') ?? '');
  if (!token) return 'Please complete the anti-spam check.';

  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET_KEY);
  body.append('response', token);
  const ip = req.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? null : 'Anti-spam check failed. Please try again.';
  } catch {
    return 'Could not verify the anti-spam check. Please try again.';
  }
}
