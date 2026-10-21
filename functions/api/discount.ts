import type { Env } from '../_lib/env';
import { jsonResponse, sameOrigin } from '../_lib/http';
import { checkCode } from '../_lib/discounts';

/** POST /api/discount { code }: the cart checks a discount code before checkout (checkout checks it again). */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!sameOrigin(request)) return jsonResponse(403, { ok: false, error: 'Forbidden.' });
  const body = (await request.json().catch(() => ({}))) as { code?: unknown };
  const found = await checkCode(env, body.code).catch(() => ({ ok: false as const, error: 'Could not check the code right now.' }));
  if (!found.ok) return jsonResponse(400, { ok: false, error: found.error });
  return jsonResponse(200, { ok: true, code: found.code.code, percent: found.code.percent });
};
