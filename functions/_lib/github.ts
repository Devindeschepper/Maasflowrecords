import type { Env } from './env';

/**
 * Saves files in the website's GitHub repository (GitHub Contents API). Every save is a commit on main, which
 * makes Cloudflare rebuild and publish the site (about 2 minutes). Used by the private shop page.
 * Needs GITHUB_TOKEN: a fine-grained token for this repository only, with Contents: read and write.
 */
const REPO = 'Devindeschepper/Maasflowrecords';
const BRANCH = 'main';

export const githubConfigured = (env: Env) => !!env.GITHUB_TOKEN?.trim();

const headers = (env: Env) => ({
  Authorization: `Bearer ${env.GITHUB_TOKEN!.trim()}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'maasflowrecords-shop',
  'X-GitHub-Api-Version': '2022-11-28',
});

const url = (path: string) => `https://api.github.com/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

function b64ToText(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
export function textToB64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The current version of a file on main (null when it doesn't exist). */
export async function readFile(env: Env, path: string): Promise<{ sha: string; text: string } | null> {
  const res = await fetch(`${url(path)}?ref=${BRANCH}`, { headers: headers(env) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const data = (await res.json()) as { sha: string; content: string };
  return { sha: data.sha, text: b64ToText(data.content) };
}

/** Creates or replaces a file on main (content already base64). `sha` is required when replacing. */
export async function writeFile(env: Env, path: string, contentB64: string, message: string, sha?: string): Promise<void> {
  const res = await fetch(url(path), {
    method: 'PUT',
    headers: { ...headers(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentB64, branch: BRANCH, ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(res.status === 409 ? 'Someone changed this at the same time. Try again.' : `GitHub ${res.status}${err.message ? `: ${err.message}` : ''}`);
  }
}

/** Reads a JSON file, lets `change` edit it, and saves it (with the same 2-space formatting). */
export async function updateJson<T>(env: Env, path: string, message: string, change: (data: T) => T | void): Promise<T> {
  const file = await readFile(env, path);
  if (!file) throw new Error(`${path} not found`);
  const data = JSON.parse(file.text) as T;
  const next = (change(data) ?? data) as T;
  await writeFile(env, path, textToB64(`${JSON.stringify(next, null, 2)}\n`), message, file.sha);
  return next;
}
