import type { Env } from '../_lib/env';
import { reply, sameOrigin, str, isEmail } from '../_lib/http';
import { checkSpam } from '../_lib/spam';
import { addRestockRequest } from '../_lib/restock';
import { products } from '../../src/data/products';

/** "Tell me when it's back" on a sold-out product (shop page). The email goes out once it's in stock again. */
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

  const product = products.find((p) => p.id === str(fd, 'product', 100));
  if (!product) return reply(request, 400, { ok: false, error: 'Please choose a product.' });
  const email = str(fd, 'email', 200).toLowerCase();
  if (!isEmail(email)) return reply(request, 400, { ok: false, error: 'Please enter a valid email address.' });

  try {
    const saved = await addRestockRequest(env, product.id, email);
    if (saved === 'unavailable') return reply(request, 503, { ok: false, error: 'This is not available right now.' });
    if (saved === 'full') return reply(request, 429, { ok: false, error: 'Too many people are already waiting for this one. Follow us to see when it is back.' });
  } catch (err) {
    console.error('Restock request failed', err);
    return reply(request, 502, { ok: false, error: 'Saving failed right now.' });
  }
  return reply(request, 200, { ok: true });
};
