import type { Env } from './env';
import { notifyWhatsApp } from './whatsapp';

/**
 * Studio sessions and knocks, stored in D1 (binding DB). A session starts with the first
 * "on" from the studio PC and ends with "off" (or, after a crash, at its last heartbeat).
 * Times are epoch milliseconds.
 */
export const STALE_MS = 15 * 60 * 1000; // no heartbeat for this long = the session ended

export interface Session {
  id: number;
  started_at: number;
  last_beat: number;
  ended_at: number | null;
  knocks: number;
}

let schemaReady = false;

/** Creates the tables on first use, so no migration step is needed on deploy. */
export async function db(env: Env): Promise<D1Database | null> {
  if (!env.DB) return null;
  if (!schemaReady) {
    await env.DB.batch([
      env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at INTEGER NOT NULL, last_beat INTEGER NOT NULL, ended_at INTEGER, knocks INTEGER NOT NULL DEFAULT 0)',
      ),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS sessions_started ON sessions (started_at)'),
      env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS knocks (session_id INTEGER NOT NULL, visitor TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (session_id, visitor))',
      ),
      env.DB.prepare('CREATE TABLE IF NOT EXISTS login_fails (visitor TEXT NOT NULL, at INTEGER NOT NULL)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS login_fails_visitor ON login_fails (visitor, at)'),
    ]);
    schemaReady = true;
  }
  return env.DB;
}

export const openSession = (d: D1Database) =>
  d.prepare('SELECT * FROM sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1').first<Session>();

/** "3h 12m", "45m". */
export function fmtDuration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, '0')}m` : `${min}m`;
}

const closeSession = (d: D1Database, s: Session, endedAt: number) =>
  d.prepare('UPDATE sessions SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL').bind(endedAt, s.id).run();

/** Reopening FL Studio within this time continues the previous session instead of starting a new one. */
export const REJOIN_MS = 30 * 60 * 1000;

/** Heartbeat from the studio PC while FL Studio is open. */
export async function sessionOn(env: Env, now: number): Promise<void> {
  const d = await db(env);
  if (!d) return;
  let s = await openSession(d);
  if (s && now - s.last_beat > STALE_MS) {
    // The PC went quiet without saying "off" (crash, sleep, no internet): close it at its last heartbeat.
    await closeSession(d, s, s.last_beat);
    s = null;
  }
  if (s) {
    await d.prepare('UPDATE sessions SET last_beat = ?1 WHERE id = ?2').bind(now, s.id).run();
    return;
  }
  // FL Studio reopened shortly after closing: continue that session.
  const recent = await d.prepare('SELECT id FROM sessions WHERE ended_at IS NOT NULL AND ended_at > ?1 ORDER BY ended_at DESC LIMIT 1').bind(now - REJOIN_MS).first<{ id: number }>();
  if (recent) await d.prepare('UPDATE sessions SET ended_at = NULL, last_beat = ?1 WHERE id = ?2').bind(now, recent.id).run();
  else await d.prepare('INSERT INTO sessions (started_at, last_beat) VALUES (?1, ?1)').bind(now).run();
}

/** FL Studio closed. */
export async function sessionOff(env: Env, now: number): Promise<void> {
  const d = await db(env);
  if (!d) return;
  const s = await openSession(d);
  if (s) await closeSession(d, s, now - s.last_beat > STALE_MS ? s.last_beat : now);
}

/** Totals for a time window: hours (ms), sessions and knocks; open sessions count up to now. */
export function summarize(sessions: Session[], from: number, to: number) {
  let ms = 0;
  let knocks = 0;
  let count = 0;
  for (const s of sessions) {
    const end = s.ended_at ?? Math.min(to, s.last_beat + STALE_MS);
    if (end <= from || s.started_at >= to) continue;
    const part = Math.min(end, to) - Math.max(s.started_at, from);
    ms += part;
    knocks += s.knocks;
    if (part >= 60000) count++; // FL opened and closed right away doesn't count as a session
  }
  return { ms, hours: Math.round((ms / 3600000) * 10) / 10, sessions: count, knocks };
}

/** Monday 00:00 (Luxembourg time) of the week containing `t`, as epoch ms. */
export function weekStart(t: number): number {
  const tz = 'Europe/Luxembourg';
  const local = new Date(new Date(t).toLocaleString('en-US', { timeZone: tz }));
  const offset = local.getTime() - t; // local wall clock minus UTC
  const day = (local.getDay() + 6) % 7; // Monday = 0
  local.setHours(0, 0, 0, 0);
  local.setDate(local.getDate() - day);
  return local.getTime() - offset;
}

export const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Sunday-evening WhatsApp summary of the week (cron in wrangler.toml). */
export async function weeklySummary(env: Env, now: number): Promise<void> {
  const d = await db(env);
  if (!d) return;
  const from = weekStart(now);
  const { results } = await d.prepare('SELECT * FROM sessions WHERE started_at >= ?1 OR ended_at IS NULL OR ended_at >= ?1').bind(from - WEEK_MS).all<Session>();
  const week = summarize(results, from, now);
  const prev = summarize(results, from - WEEK_MS, from);
  const diff = week.ms - prev.ms;
  const trend = prev.ms ? ` (${diff >= 0 ? '+' : '−'}${fmtDuration(Math.abs(diff))} vs last week)` : '';
  await notifyWhatsApp(
    env,
    [
      '🔴 Maas Flow Records · your week',
      `Studio: ${fmtDuration(week.ms)} in ${week.sessions} session${week.sessions === 1 ? '' : 's'}${trend}`,
      `Knocks: ${week.knocks}`,
      'Stats: maasflowrecords.com/studio-stats/',
    ].join('\n'),
  );
}
