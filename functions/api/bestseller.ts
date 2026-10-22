import type { Env } from '../_lib/env';
import { jsonResponse } from '../_lib/http';
import { bestSeller } from '../_lib/sales';

/** Which product gets the "Best seller" tag on the shop page (public, no personal data). */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    return jsonResponse(200, { id: await bestSeller(env) });
  } catch (err) {
    console.error('Best seller failed', err);
    return jsonResponse(200, { id: null });
  }
};
