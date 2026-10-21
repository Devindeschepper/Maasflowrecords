// Texts used by the browser scripts (cart, forms, studio light). The page language is read from <html lang>.
import { LOCALES, type Lang } from './index';

const en = {
  knockOff: 'Lights up when VIN is in the studio',
  knockOffLabel: 'In the studio: off',
  knockLive: 'VIN is in the studio right now. Click to knock',
  knockLiveLabel: 'In the studio: VIN is in the studio right now. Knock on the door',
  knockLeft: 'VIN has just left the studio. Check back soon.',
  knockReceived: (others: number) => `Knock received. VIN is in the studio working on new music.${others ? ` ${others} other${others === 1 ? '' : 's'} knocked this session.` : ''}`,
  knockAgain: 'Your knock was already received. Thank you for the support.',
  knockError: 'Something went wrong. Please try again in a moment.',
  cartItems: (n: number) => `Shopping cart, ${n} item${n === 1 ? '' : 's'}`,
  added: (href: string) => `Added to cart - <a href="${href}">view cart</a>`,
  sending: 'Sending…',
  sent: 'Thanks - your message was sent.',
  tooLarge: (mb: number) => `File is too large (max ${mb} MB). Share a link instead.`,
  failed: 'Something went wrong. Please try again.',
  orEmail: (email: string) => `You can also email ${email}.`,
  size: 'Size',
  preorder: 'Pre-order',
  decrease: (x: string) => `Decrease quantity of ${x}`,
  increase: (x: string) => `Increase quantity of ${x}`,
  quantity: (n: number) => `Quantity ${n}`,
  remove: 'Remove',
  removeItem: (x: string) => `Remove ${x}`,
  discount: (code: string, p: number) => `Discount ${code} (-${p}%)`,
  codeOk: (p: number) => `✓ ${p}% off`,
  codeBad: 'This discount code does not work.',
  noVat: 'No VAT charged (small business exemption)',
  inclVat: (rate: number) => `Incl. ${rate}% VAT`,
  exportVat: 'No EU VAT (export). Import taxes may apply in your country.',
  opening: 'Opening the payment page…',
  placing: 'Placing order…',
  checkoutFailed: 'Checkout failed. Please try again.',
  received: 'Your order was received.',
  questions: (email: string) => `Questions: ${email}`,
  dropWhen: (d: string) => `on ${d}`,
};

type Client = typeof en;

const fr: Client = {
  knockOff: "S'allume quand VIN est au studio",
  knockOffLabel: 'Au studio : éteint',
  knockLive: 'VIN est au studio en ce moment. Clique pour frapper',
  knockLiveLabel: 'Au studio : VIN est au studio en ce moment. Frapper à la porte',
  knockLeft: 'VIN vient de quitter le studio. Repasse bientôt.',
  knockReceived: (others) => `Toc toc reçu. VIN est au studio et travaille sur de la nouvelle musique.${others ? ` ${others} autre${others === 1 ? '' : 's'} personne${others === 1 ? '' : 's'} ont frappé pendant cette session.` : ''}`,
  knockAgain: 'Ton toc toc a déjà été reçu. Merci pour le soutien.',
  knockError: 'Un problème est survenu. Réessaie dans un instant.',
  cartItems: (n) => `Panier, ${n} article${n === 1 ? '' : 's'}`,
  added: (href) => `Ajouté au panier - <a href="${href}">voir le panier</a>`,
  sending: 'Envoi…',
  sent: 'Merci - ton message a bien été envoyé.',
  tooLarge: (mb) => `Le fichier est trop lourd (max ${mb} Mo). Envoie plutôt un lien.`,
  failed: 'Un problème est survenu. Réessaie.',
  orEmail: (email) => `Tu peux aussi écrire à ${email}.`,
  size: 'Taille',
  preorder: 'Précommande',
  decrease: (x) => `Diminuer la quantité de ${x}`,
  increase: (x) => `Augmenter la quantité de ${x}`,
  quantity: (n) => `Quantité ${n}`,
  remove: 'Retirer',
  removeItem: (x) => `Retirer ${x}`,
  discount: (code, p) => `Réduction ${code} (-${p} %)`,
  codeOk: (p) => `✓ ${p} % de réduction`,
  codeBad: 'Ce code de réduction ne fonctionne pas.',
  noVat: 'Pas de TVA (régime de franchise des petites entreprises)',
  inclVat: (rate) => `TVA ${rate} % incluse`,
  exportVat: "Pas de TVA UE (export). Des taxes d'importation peuvent s'appliquer dans ton pays.",
  opening: 'Ouverture de la page de paiement…',
  placing: 'Envoi de la commande…',
  checkoutFailed: 'Le paiement a échoué. Réessaie.',
  received: 'Ta commande a bien été reçue.',
  questions: (email) => `Questions : ${email}`,
  dropWhen: (d) => `le ${d}`,
};

const de: Client = {
  knockOff: 'Leuchtet, wenn VIN im Studio ist',
  knockOffLabel: 'Im Studio: aus',
  knockLive: 'VIN ist gerade im Studio. Klick zum Anklopfen',
  knockLiveLabel: 'Im Studio: VIN ist gerade im Studio. An die Tür klopfen',
  knockLeft: 'VIN hat das Studio gerade verlassen. Schau bald wieder vorbei.',
  knockReceived: (others) => `Klopfen angekommen. VIN ist im Studio und arbeitet an neuer Musik.${others ? ` ${others} ${others === 1 ? 'andere Person hat' : 'andere haben'} in dieser Session geklopft.` : ''}`,
  knockAgain: 'Dein Klopfen ist schon angekommen. Danke für den Support.',
  knockError: 'Etwas ist schiefgelaufen. Versuch es gleich nochmal.',
  cartItems: (n) => `Warenkorb, ${n} Artikel`,
  added: (href) => `Im Warenkorb - <a href="${href}">Warenkorb ansehen</a>`,
  sending: 'Wird gesendet…',
  sent: 'Danke - deine Nachricht wurde gesendet.',
  tooLarge: (mb) => `Die Datei ist zu groß (max. ${mb} MB). Schick lieber einen Link.`,
  failed: 'Etwas ist schiefgelaufen. Bitte versuch es nochmal.',
  orEmail: (email) => `Du kannst auch an ${email} schreiben.`,
  size: 'Größe',
  preorder: 'Vorbestellung',
  decrease: (x) => `Menge von ${x} verringern`,
  increase: (x) => `Menge von ${x} erhöhen`,
  quantity: (n) => `Menge ${n}`,
  remove: 'Entfernen',
  removeItem: (x) => `${x} entfernen`,
  discount: (code, p) => `Rabatt ${code} (-${p} %)`,
  codeOk: (p) => `✓ ${p} % Rabatt`,
  codeBad: 'Dieser Rabattcode funktioniert nicht.',
  noVat: 'Keine MwSt. (Kleinunternehmerregelung)',
  inclVat: (rate) => `Inkl. ${rate} % MwSt.`,
  exportVat: 'Keine EU-MwSt. (Export). In deinem Land können Einfuhrabgaben anfallen.',
  opening: 'Zahlungsseite wird geöffnet…',
  placing: 'Bestellung wird gesendet…',
  checkoutFailed: 'Bezahlen hat nicht geklappt. Bitte versuch es nochmal.',
  received: 'Deine Bestellung ist angekommen.',
  questions: (email) => `Fragen: ${email}`,
  dropWhen: (d) => `am ${d}`,
};

const all: Record<Lang, Client> = { en, fr, de };

export const pageLang = (): Lang => {
  const l = document.documentElement.lang;
  return l === 'fr' || l === 'de' ? l : 'en';
};
/** Texts for the current page's language. */
export const tc = (): Client => all[pageLang()];
export const pageLocale = () => LOCALES[pageLang()];
/** '/cart/' → '/fr/cart/' on French pages. */
export const here = (path: string) => (pageLang() === 'en' ? path : `/${pageLang()}${path}`);
