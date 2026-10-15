import type { APIRoute } from 'astro';
import { releases } from '../data/releases';

// Release dates for the worker's anniversary message (functions/_lib/anniversary.ts). Only releases with a
// fixed date; built once with the site, so new releases added in the admin panel are included automatically.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      releases
        .filter((r) => r.releaseDate && !r.dateTentative)
        .map((r) => ({ slug: r.slug, title: r.title, type: r.type, date: r.releaseDate })),
    ),
    { headers: { 'Content-Type': 'application/json' } },
  );
