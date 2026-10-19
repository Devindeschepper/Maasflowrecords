import type { Env } from './env';
import { githubConfigured, readFile, updateJson } from './github';
import { notifyWhatsApp } from './whatsapp';
import { dropAt, dropStarted } from '../../src/data/site';

/**
 * Hourly cron after a timed drop has started: the shop is already visible in browsers (the countdown opens it),
 * so this only tidies up: saves "shop open" in the settings and removes the drop time. Plus one WhatsApp to VIN.
 * Never throws.
 */
export async function finishDrop(env: Env, now: number): Promise<void> {
  if (!dropAt || !dropStarted(now) || !githubConfigured(env)) return;
  try {
    const path = 'src/content/settings.json';
    const current = JSON.parse((await readFile(env, path))?.text ?? '{}') as { shopOpen?: boolean; dropAt?: string };
    // Only if the settings still hold this drop (VIN may have cancelled or moved it since the last build).
    if (current.shopOpen === true || !current.dropAt || Date.parse(current.dropAt) !== Date.parse(dropAt)) return;
    await updateJson<Record<string, unknown>>(env, path, 'Shop: the timed drop started, shop open', (s) => {
      delete s.dropAt;
      s.shopOpen = true;
    });
    await notifyWhatsApp(env, '🔥 Your drop is live: the shop is open on maasflowrecords.com/shop');
  } catch (err) {
    console.error('Finishing the drop failed', err);
  }
}
