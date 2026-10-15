import type { Env } from './env';
import { escapeHtml, oneLine } from './http';
import { notifyWhatsApp, whatsAppSummary } from './whatsapp';

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
  /** Optional paragraphs shown above the table (plain text, escaped). */
  intro?: string[];
  /** WhatsApp text for this label email instead of the default subject + sender summary. */
  whatsApp?: string;
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
  const intro = mail.intro ?? [];
  const introHtml = intro.map((p) => `<p style="font-family:sans-serif;line-height:1.5">${escapeHtml(p)}</p>`).join('');
  const text = [...intro, ...mail.fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join('\n\n');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: [to],
      subject: oneLine(mail.subject).slice(0, 200),
      reply_to: mail.replyTo,
      html: rows ? `${introHtml}<table>${rows}</table>` : introHtml,
      text,
      attachments: mail.attachments,
    }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text().catch(() => ''));
    throw new Error('Email delivery failed.');
  }
  // Emails to the label (no explicit `to`) also ping the label's WhatsApp; emails to customers don't.
  if (!mail.to) await notifyWhatsApp(env, mail.whatsApp ?? whatsAppSummary(mail.subject, mail.fields));
}

/**
 * Short thank-you email to the person who filled in a form. Replies go to the label.
 * Fixed text only (no copy of what they typed), so the form can't be used to send spam to others.
 * Never throws: the request already reached the label.
 */
export async function sendConfirmation(
  env: Env,
  c: { to: string; name: string; what: string; next?: string },
): Promise<void> {
  const label = env.CONTACT_TO_EMAIL ?? 'info@maasflowrecords.com';
  const first = c.name.trim().split(/\s+/)[0]?.slice(0, 40) || 'there';
  try {
    await sendMail(env, {
      to: c.to,
      replyTo: label,
      subject: `We received your ${c.what} - Maas Flow Records`,
      intro: [
        `Hi ${first},`,
        `Thanks for your ${c.what}. ${c.next ?? 'It reached us and VIN will get back to you within 48 hours.'}`,
        'Want to add something? Just reply to this email.',
        'Maas Flow Records · maasflowrecords.com',
      ],
      fields: [],
    });
  } catch (err) {
    console.error('Confirmation email failed', err);
  }
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { filename: file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'upload', content: btoa(bin) };
}
