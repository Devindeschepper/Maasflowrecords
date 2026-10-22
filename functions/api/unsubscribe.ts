import type { Env } from '../_lib/env';
import { escapeHtml } from '../_lib/http';
import { validUnsubscribe } from '../_lib/release-mail';

/**
 * Unsubscribe link in the newsletter emails. GET shows a confirm button (so mail scanners that open links
 * don't unsubscribe anyone); POST does it, also used by the mail app's own "Unsubscribe" (one-click).
 */
const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} - Maas Flow Records</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e0e;color:#eee;font:16px/1.5 system-ui,sans-serif;padding:16px;box-sizing:border-box}main{max-width:420px;text-align:center}h1{font-size:1.4rem}button{background:#eee;color:#111;border:0;padding:.8rem 1.6rem;font:600 .9rem system-ui;cursor:pointer}a{color:#e33}</style></head>
<body><main><h1>${title}</h1>${body}<p><a href="/">maasflowrecords.com</a></p></main></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

const params = (request: Request) => {
  const u = new URL(request.url);
  return { email: (u.searchParams.get('e') ?? '').trim().slice(0, 200), token: u.searchParams.get('t') ?? '' };
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const { email, token } = params(request);
  if (!(await validUnsubscribe(env, email, token))) return page('Link not valid', '<p>This unsubscribe link is not valid. Email info@maasflowrecords.com and we remove you by hand.</p>', 400);
  return page(
    'Unsubscribe?',
    `<p>Stop the newsletter for <strong>${escapeHtml(email)}</strong>?</p><form method="post"><button type="submit">Unsubscribe</button></form>`,
  );
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { email, token } = params(request);
  if (!(await validUnsubscribe(env, email, token))) return page('Link not valid', '<p>This unsubscribe link is not valid.</p>', 400);
  const base = env.RESEND_AUDIENCE_ID
    ? `https://api.resend.com/audiences/${encodeURIComponent(env.RESEND_AUDIENCE_ID)}/contacts`
    : 'https://api.resend.com/contacts';
  const res = await fetch(`${base}/${encodeURIComponent(email)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY?.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ unsubscribed: true }),
  }).catch(() => null);
  if (!res?.ok) {
    console.error('Unsubscribe failed', res?.status, await res?.text().catch(() => ''));
    return page('Something went wrong', '<p>Please try again later, or email info@maasflowrecords.com.</p>', 502);
  }
  return page('You are unsubscribed', '<p>You won’t get the newsletter anymore.</p>');
};
