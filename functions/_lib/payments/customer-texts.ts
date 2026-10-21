/**
 * The emails customers get, in the language they shopped in (English, French or German).
 * Emails to the label stay in English.
 */
export type MailLang = 'en' | 'fr' | 'de';
export const mailLang = (v: unknown): MailLang => (v === 'fr' || v === 'de' ? v : 'en');

const texts = {
  en: {
    paidSubject: (id: string) => `Payment received - Maas Flow Records order ${id}`,
    thanksLabel: 'Thank you',
    paidThanks: (name?: string) => `${name ? `Hi ${name}, t` : 'T'}hanks for your order! Your payment was received. Pre-orders ship on or around the release date; you'll get an email when it's on the way.`,
    order: 'Order', items: 'Items', paid: 'Paid', total: 'Total', vat: 'VAT', questions: 'Questions',
    questionsText: 'Reply to this email or write to info@maasflowrecords.com',
    manualSubject: (id: string) => `Your Maas Flow Records order ${id}`,
    manualThanks: (name: string) => `Hi ${name}, we received your order. You'll get a payment request from us by email within 1–2 working days. Your order ships after payment.`,
    inclShipping: (s: string) => `incl. ${s} shipping`,
    manualMessage: (id: string) => `Order ${id} received. We'll email you a payment request within 1–2 working days - your order ships after payment.`,
    preorder: '[PRE-ORDER]',
    size: 'size',
    vatIncl: (rate: string) => `Incl. ${rate}% VAT`,
    vatExempt: 'No VAT charged (small business exemption)',
    vatExport: 'No EU VAT (export). Import taxes may apply in your country.',
  },
  fr: {
    paidSubject: (id: string) => `Paiement reçu - commande Maas Flow Records ${id}`,
    thanksLabel: 'Merci',
    paidThanks: (name?: string) => `${name ? `Salut ${name}, m` : 'M'}erci pour ta commande ! Ton paiement a bien été reçu. Les précommandes sont expédiées autour de la date de sortie ; tu recevras un e-mail quand ton colis part.`,
    order: 'Commande', items: 'Articles', paid: 'Payé', total: 'Total', vat: 'TVA', questions: 'Questions',
    questionsText: 'Réponds à cet e-mail ou écris à info@maasflowrecords.com',
    manualSubject: (id: string) => `Ta commande Maas Flow Records ${id}`,
    manualThanks: (name: string) => `Salut ${name}, on a bien reçu ta commande. Tu recevras une demande de paiement par e-mail sous 1 à 2 jours ouvrés. Ta commande est expédiée après le paiement.`,
    inclShipping: (s: string) => `dont ${s} de livraison`,
    manualMessage: (id: string) => `Commande ${id} reçue. On t'envoie une demande de paiement par e-mail sous 1 à 2 jours ouvrés - ta commande est expédiée après le paiement.`,
    preorder: '[PRÉCOMMANDE]',
    size: 'taille',
    vatIncl: (rate: string) => `TVA ${rate} % incluse`,
    vatExempt: 'Pas de TVA (régime de franchise des petites entreprises)',
    vatExport: "Pas de TVA UE (export). Des taxes d'importation peuvent s'appliquer dans ton pays.",
  },
  de: {
    paidSubject: (id: string) => `Zahlung erhalten - Maas Flow Records Bestellung ${id}`,
    thanksLabel: 'Danke',
    paidThanks: (name?: string) => `${name ? `Hi ${name}, d` : 'D'}anke für deine Bestellung! Deine Zahlung ist angekommen. Vorbestellungen werden um das Release-Datum herum verschickt; du bekommst eine E-Mail, sobald dein Paket unterwegs ist.`,
    order: 'Bestellung', items: 'Artikel', paid: 'Bezahlt', total: 'Gesamt', vat: 'MwSt.', questions: 'Fragen',
    questionsText: 'Antworte auf diese E-Mail oder schreib an info@maasflowrecords.com',
    manualSubject: (id: string) => `Deine Maas Flow Records Bestellung ${id}`,
    manualThanks: (name: string) => `Hi ${name}, wir haben deine Bestellung erhalten. Du bekommst innerhalb von 1–2 Werktagen eine Zahlungsaufforderung per E-Mail. Deine Bestellung wird nach der Zahlung verschickt.`,
    inclShipping: (s: string) => `inkl. ${s} Versand`,
    manualMessage: (id: string) => `Bestellung ${id} erhalten. Wir schicken dir innerhalb von 1–2 Werktagen eine Zahlungsaufforderung per E-Mail - die Bestellung wird nach der Zahlung verschickt.`,
    preorder: '[VORBESTELLUNG]',
    size: 'Größe',
    vatIncl: (rate: string) => `Inkl. ${rate} % MwSt.`,
    vatExempt: 'Keine MwSt. (Kleinunternehmerregelung)',
    vatExport: 'Keine EU-MwSt. (Export). In deinem Land können Einfuhrabgaben anfallen.',
  },
};

export const customerTexts = (lang: MailLang) => texts[lang];

/** The English VAT line ("Incl. 17% VAT: €2.47", "No EU VAT (export)…") in the customer's language. */
export function vatForCustomer(text: string, lang: MailLang): string {
  if (lang === 'en' || !text) return text;
  const t = texts[lang];
  const incl = text.match(/^Incl\. (\d+(?:\.\d+)?)% VAT(.*)$/);
  if (incl) return `${t.vatIncl(incl[1])}${incl[2]}`;
  if (text.startsWith('No VAT charged')) return t.vatExempt;
  if (text.startsWith('No EU VAT')) return t.vatExport;
  return text;
}

/** Item lines for the customer: the pre-order tag in their language. */
export const itemsForCustomer = (items: string, lang: MailLang) =>
  items.split('[PRE-ORDER]').join(texts[lang].preorder).split('(size ').join(`(${texts[lang].size} `);
