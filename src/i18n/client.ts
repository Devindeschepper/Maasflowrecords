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
  twitchLong: 'Live on Twitch',
  twitchShort: 'Live',
  twitchLabel: 'VIN is live on Twitch right now. Watch the stream',
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
  twitchLong: 'En live sur Twitch',
  twitchShort: 'Live',
  twitchLabel: 'VIN est en live sur Twitch. Regarder le stream',
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
  twitchLong: 'Live auf Twitch',
  twitchShort: 'Live',
  twitchLabel: 'VIN ist gerade live auf Twitch. Stream ansehen',
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

/**
 * The server answers in English. On French and German pages its messages are shown in the page's language
 * (known messages below; anything else stays as it came).
 */
const SERVER: Record<string, [fr: string, de: string]> = {
  'Please enter a valid email address.': ['Merci d’entrer une adresse e-mail valide.', 'Bitte gib eine gültige E-Mail-Adresse ein.'],
  'Please fill in all required fields.': ['Merci de remplir tous les champs obligatoires.', 'Bitte fülle alle Pflichtfelder aus.'],
  'Please fill in your shipping details.': ['Merci de remplir ton adresse de livraison.', 'Bitte gib deine Lieferadresse ein.'],
  'Please choose your country.': ['Merci de choisir ton pays.', 'Bitte wähle dein Land.'],
  "Sorry, we can't ship to this country yet.": ['Désolé, on ne livre pas encore dans ce pays.', 'Sorry, in dieses Land liefern wir noch nicht.'],
  'Please accept the shipping & returns terms.': ['Merci d’accepter les conditions de livraison et de retour.', 'Bitte akzeptiere die Versand- und Rückgabebedingungen.'],
  'Please choose a payment method.': ['Merci de choisir un moyen de paiement.', 'Bitte wähle eine Zahlungsart.'],
  'Your cart is empty.': ['Ton panier est vide.', 'Dein Warenkorb ist leer.'],
  'An item in your cart is no longer available.': ['Un article de ton panier n’est plus disponible.', 'Ein Artikel in deinem Warenkorb ist nicht mehr verfügbar.'],
  'Invalid quantity.': ['Quantité invalide.', 'Ungültige Menge.'],
  'Invalid cart.': ['Panier invalide.', 'Ungültiger Warenkorb.'],
  'Checkout is temporarily unavailable.': ['Le paiement est momentanément indisponible.', 'Die Kasse ist gerade nicht verfügbar.'],
  'This payment method is not available right now. Please choose another one or email us.': ['Ce moyen de paiement n’est pas disponible pour le moment. Choisis-en un autre ou écris-nous.', 'Diese Zahlungsart ist gerade nicht verfügbar. Wähl eine andere oder schreib uns.'],
  'The shop is not open yet.': ['La boutique n’est pas encore ouverte.', 'Der Shop ist noch nicht geöffnet.'],
  'The drop has not started yet. Come back when the countdown ends.': ['Le drop n’a pas encore commencé. Reviens à la fin du compte à rebours.', 'Der Drop hat noch nicht begonnen. Komm wieder, wenn der Countdown vorbei ist.'],
  'This discount code does not exist.': ['Ce code de réduction n’existe pas.', 'Diesen Rabattcode gibt es nicht.'],
  'This discount code has expired.': ['Ce code de réduction a expiré.', 'Dieser Rabattcode ist abgelaufen.'],
  'This discount code has been used up.': ['Ce code de réduction a déjà été utilisé au maximum.', 'Dieser Rabattcode ist aufgebraucht.'],
  'Could not check the code right now.': ['Impossible de vérifier le code pour le moment.', 'Der Code kann gerade nicht geprüft werden.'],
  'Please take a moment before submitting.': ['Prends un instant avant d’envoyer.', 'Nimm dir einen Moment, bevor du absendest.'],
  'Please complete the anti-spam check.': ['Merci de compléter la vérification anti-spam.', 'Bitte schließe die Anti-Spam-Prüfung ab.'],
  'Could not verify the anti-spam check. Please try again.': ['Impossible de vérifier l’anti-spam. Réessaie.', 'Die Anti-Spam-Prüfung hat nicht geklappt. Bitte versuch es nochmal.'],
  'Anti-spam check failed. Please try again.': ['La vérification anti-spam a échoué. Réessaie.', 'Die Anti-Spam-Prüfung ist fehlgeschlagen. Bitte versuch es nochmal.'],
  'Please choose a product.': ['Merci de choisir un produit.', 'Bitte wähle ein Produkt.'],
  'Please choose an artist.': ['Merci de choisir un artiste.', 'Bitte wähle einen Artist.'],
  'Please choose the type of event.': ['Merci de choisir le type d’événement.', 'Bitte wähle die Art des Events.'],
  'Please choose what you need.': ['Merci de choisir ce dont tu as besoin.', 'Bitte wähle, was du brauchst.'],
  'Please choose your role.': ['Merci de choisir ton rôle.', 'Bitte wähle deine Rolle.'],
  'Please choose the number of stems.': ['Merci de choisir le nombre de pistes.', 'Bitte wähle die Anzahl der Stems.'],
  'Please enter the number of songs.': ['Merci d’indiquer le nombre de morceaux.', 'Bitte gib die Anzahl der Songs an.'],
  'Please enter a valid date.': ['Merci d’entrer une date valide.', 'Bitte gib ein gültiges Datum ein.'],
  'Please accept the privacy consent.': ['Merci d’accepter la mention de confidentialité.', 'Bitte stimme dem Datenschutz zu.'],
  'Please tick the box to agree to receive emails.': ['Merci de cocher la case pour accepter de recevoir des e-mails.', 'Bitte setz den Haken, um E-Mails zu erhalten.'],
  'Allowed file types: MP3, WAV, M4A, PDF, ZIP.': ['Types de fichiers acceptés : MP3, WAV, M4A, PDF, ZIP.', 'Erlaubte Dateitypen: MP3, WAV, M4A, PDF, ZIP.'],
  'File too large (max 10 MB).': ['Fichier trop lourd (max 10 Mo).', 'Datei zu groß (max. 10 MB).'],
  'Upload too large (max 10 MB). Please share a link instead.': ['Fichier trop lourd (max 10 Mo). Envoie plutôt un lien.', 'Datei zu groß (max. 10 MB). Schick lieber einen Link.'],
  'Your message could not be sent right now.': ['Ton message n’a pas pu être envoyé pour le moment.', 'Deine Nachricht konnte gerade nicht gesendet werden.'],
  'Your request could not be sent right now.': ['Ta demande n’a pas pu être envoyée pour le moment.', 'Deine Anfrage konnte gerade nicht gesendet werden.'],
  'Your submission could not be sent right now.': ['Ton envoi n’a pas pu être transmis pour le moment.', 'Deine Einsendung konnte gerade nicht gesendet werden.'],
  'Signing up failed right now.': ['L’inscription n’a pas fonctionné pour le moment.', 'Die Anmeldung hat gerade nicht geklappt.'],
  'Saving failed right now.': ['L’enregistrement n’a pas fonctionné pour le moment.', 'Speichern hat gerade nicht geklappt.'],
  'This is not available right now.': ['Ce n’est pas disponible pour le moment.', 'Das ist gerade nicht verfügbar.'],
  'Too many people are already waiting for this one. Follow us to see when it is back.': ['Trop de personnes attendent déjà ce produit. Suis-nous pour savoir quand il revient.', 'Zu viele warten schon auf diesen Artikel. Folg uns, um zu sehen, wann er wieder da ist.'],
  'Spam detected.': ['Spam détecté.', 'Spam erkannt.'],
};

export function serverMessage(msg: string): string {
  const l = pageLang();
  if (l === 'en' || !msg) return msg;
  const i = l === 'fr' ? 0 : 1;
  if (SERVER[msg]) return SERVER[msg][i];
  let m = msg.match(/^Sorry, only (\d+) of "(.+)" left\.$/);
  if (m) return l === 'fr' ? `Désolé, il ne reste que ${m[1]} × « ${m[2].replace('" in size "', ' » en taille « ')} ».` : `Sorry, nur noch ${m[1]} × „${m[2].replace('" in size "', '“ in Größe „')}“.`;
  m = msg.match(/^Sorry, "(.+)" is sold out\.$/);
  if (m) return l === 'fr' ? `Désolé, « ${m[1].replace('" in size "', ' » en taille « ')} » est épuisé.` : `Sorry, „${m[1].replace('" in size "', '“ in Größe „')}“ ist ausverkauft.`;
  m = msg.match(/^Please choose a valid size for "(.+)"\.$/);
  if (m) return l === 'fr' ? `Merci de choisir une taille pour « ${m[1]} ».` : `Bitte wähle eine Größe für „${m[1]}“.`;
  return msg;
}
