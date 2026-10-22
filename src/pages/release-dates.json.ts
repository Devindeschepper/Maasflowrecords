import type { APIRoute } from 'astro';
import { releases } from '../data/releases';

// Release dates for the worker's anniversary message (functions/_lib/anniversary.ts) and the new-release
// newsletter (functions/_lib/release-mail.ts). Only releases with a
// fixed date; built once with the site, so new releases added in the admin panel are included automatically.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      releases
        .filter((r) => r.releaseDate && !r.dateTentative)
        .map((r) => ({ slug: r.slug, title: r.title, type: r.type, date: r.releaseDate, label: r.label })),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
