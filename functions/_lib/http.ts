const wantsJson = (req: Request) => (req.headers.get('Accept') ?? '').includes('application/json');

export const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/** JSON for fetch() callers; a redirect for plain HTML form posts (no-JS fallback). */
export function reply(req: Request, status: number, body: Record<string, unknown>) {
  if (wantsJson(req)) return jsonResponse(status, body);
  if (status < 400) return Response.redirect(new URL('/thanks/', req.url).href, 303);
  return new Response(`${String(body.error ?? 'Error')}\n\nPlease go back and try again, or email info@maasflowrecords.com.`, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

/** Only accept form posts coming from our own pages. */
export function sameOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  if (!origin) return true; // some privacy browsers strip Origin on same-site posts
  return origin === new URL(req.url).origin;
}

export const str = (fd: FormData, key: string, max: number) =>
  String(fd.get(key) ?? '').trim().slice(0, max);

export const isEmail = (v: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v) && v.length <= 200;

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Strip CR/LF so user input can't inject email headers (e.g. in the subject). */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ');
