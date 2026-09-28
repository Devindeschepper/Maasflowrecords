import type { Env } from './env';
import { escapeHtml, oneLine } from './http';

export interface Attachment {
  filename: string;
  /** base64 */
  content: string;
}

export interface Mail {
  subject: string;
  replyTo?: string;
  /** Plain key/value rows rendered into a simple table. Values are escaped. */
  fields: [string, string][];
  attachments?: Attachment[];
  to?: string;
}

/**
 * Sends an email via Resend (https://resend.com/docs/api-reference/emails/send-email).
 * Swap this function to use another provider — nothing else needs to change.
 */
export async function sendMail(env: Env, mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY || !env.CONTACT_FROM_EMAIL) {
    throw new Error('Email delivery is not configured (RESEND_API_KEY / CONTACT_FROM_EMAIL).');
  }
  const to = mail.to ?? env.CONTACT_TO_EMAIL ?? 'info@maasflowrecords.com';

  const rows = mail.fields
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><th align="left" valign="top" style="padding:6px 12px 6px 0;font-family:sans-serif;white-space:nowrap">${escapeHtml(k)}</th>` +
        `<td style="padding:6px 0;font-family:sans-serif;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  const text = mail.fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: [to],
      subject: oneLine(mail.subject).slice(0, 200),
      reply_to: mail.replyTo,
      html: `<table>${rows}</table>`,
      text,
      attachments: mail.attachments,
    }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    throw new Error('Email delivery failed.');
  }
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { filename: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'upload', content: btoa(bin) };
}
