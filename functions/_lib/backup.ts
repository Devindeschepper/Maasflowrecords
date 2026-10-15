import type { Env } from './env';
import { ensureTable as ensureFollowerTable, SOURCES } from './followers';
import { sendMail } from './mail';
import { contactList } from './newsletter';
import { ensureSalesTable, type SaleDetails } from './sales';
import { db, type Session } from './studio';
import { shopOpen } from '../../src/data/site';
import { toBase64, xlsx, type Cell } from './xlsx';

/**
 * Monthly backup (cron on the 1st, with the monthly report): one Excel file emailed to the label with all
 * the data the website keeps: sales (every detail), studio sessions, followers (one row per day) and the
 * newsletter list. If anything ever happens to the database, the history is safe in the inbox.
 * Starts once the shop is open (shopOpen in the admin panel); until then nothing is sent.
 */
const TZ = 'Europe/Luxembourg';
const when = (t: number | null | undefined) =>
  t ? new Date(t).toLocaleString('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const day = (t: number) => new Date(t).toLocaleDateString('en-CA', { timeZone: TZ });
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const euro = (cents: number | undefined) => (typeof cents === 'number' ? Math.round(cents) / 100 : '');

export async function backupWorkbook(env: Env): Promise<{ file: Uint8Array; counts: Record<string, number> }> {
  const d = await db(env);
  const counts: Record<string, number> = {};

  // Sales: every detail of every paid order.
  const sales: Cell[][] = [[
    'Date', 'Order', 'Real / test', 'Paid via', 'Items', 'Total €', 'Products €', 'Shipping €', 'VAT €', 'VAT', 'Shipping zone',
    'Name', 'Email', 'Address', 'Postal code', 'City', 'Country', 'Notes',
  ]];
  // Studio sessions.
  const studio: Cell[][] = [['Start', 'End', 'Duration', 'Hours', 'Knocks']];
  // Followers: the last count of each day per account.
  const followers: Cell[][] = [['Date', ...SOURCES.map((s) => s.label)]];

  if (d) {
    await ensureSalesTable(d);
    const { results: rows } = await d
      .prepare('SELECT order_id, at, total_cents, via, lines, test, details FROM sales ORDER BY at')
      .all<{ order_id: string; at: number; total_cents: number; via: string; lines: string; test: number; details: string }>();
    for (const r of rows) {
      const lines = JSON.parse(r.lines || '[]') as { name: string; qty: number; unitPrice: number; size?: string }[];
      const det = JSON.parse(r.details || '{}') as SaleDetails;
      const c = det.customer;
      sales.push([
        when(r.at), r.order_id, r.test ? 'Test' : 'Real', r.via,
        lines.map((l) => `${l.qty} × ${l.name}${l.size ? ` (${l.size})` : ''} - €${((l.unitPrice * l.qty) / 100).toFixed(2)}`).join('\n'),
        euro(r.total_cents), euro(det.subtotal), euro(det.shipping), euro(det.vat), det.vatNote ?? '', det.shippingZone ?? '',
        c?.name, c?.email, c?.address, c?.postalCode, c?.city, c?.country, c?.notes,
      ]);
    }
    counts.sales = rows.length;

    const { results: sessions } = await d.prepare('SELECT * FROM sessions ORDER BY started_at').all<Session>();
    for (const s of sessions) {
      const end = s.ended_at ?? s.last_beat;
      const min = Math.max(0, Math.round((end - s.started_at) / 60000));
      studio.push([when(s.started_at), s.ended_at ? when(s.ended_at) : 'in the studio', `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`, Math.round((min / 60) * 100) / 100, s.knocks]);
    }
    counts.sessions = sessions.length;

    await ensureFollowerTable(d);
    const { results: snaps } = await d.prepare('SELECT source, at, count FROM follower_snapshots ORDER BY at').all<{ source: string; at: number; count: number }>();
    const byDay = new Map<string, Map<string, number>>();
    for (const s of snaps) {
      const k = day(s.at);
      if (!byDay.has(k)) byDay.set(k, new Map());
      byDay.get(k)!.set(s.source, s.count); // later snapshots of the day overwrite earlier ones
    }
    for (const [k, m] of byDay) followers.push([k, ...SOURCES.map((s) => m.get(s.key) ?? '')]);
    counts.days = byDay.size;
  }

  // Newsletter list (from Resend).
  const newsletter: Cell[][] = [['Email', 'Signed up']];
  if (env.RESEND_API_KEY?.trim()) {
    try {
      const list = await contactList(env);
      for (const c of list.sort((a, b) => a.at - b.at)) newsletter.push([c.email, when(c.at)]);
      counts.subscribers = list.length;
    } catch (err) {
      newsletter.push(["Couldn't load the list this time", String(err instanceof Error ? err.message : err)]);
    }
  }

  const file = xlsx([
    { name: 'Sales', rows: sales },
    { name: 'Studio sessions', rows: studio },
    { name: 'Followers', rows: followers },
    { name: 'Newsletter', rows: newsletter },
  ]);
  return { file, counts };
}

export async function monthlyBackup(env: Env, now = Date.now()): Promise<void> {
  if (!shopOpen) return;
  try {
    const { file, counts } = await backupWorkbook(env);
    const stamp = day(now);
    await sendMail(env, {
      subject: `Maas Flow Records backup ${stamp}`,
      intro: ['Your monthly backup: everything the website keeps, in one Excel file. Keep this email (or save the file somewhere safe).'],
      fields: [
        ['Sales', `${plural(counts.sales ?? 0, 'order')} (every detail)`],
        ['Studio sessions', String(counts.sessions ?? 0)],
        ['Followers', `${plural(counts.days ?? 0, 'day')}, all accounts`],
        ['Newsletter', counts.subscribers === undefined ? 'not loaded' : plural(counts.subscribers, 'subscriber')],
      ],
      attachments: [{ filename: `maas-flow-records-backup-${stamp}.xlsx`, content: toBase64(file) }],
      whatsApp: '', // the monthly report already goes to WhatsApp
    });
  } catch (err) {
    console.error('Monthly backup failed', err);
  }
}
