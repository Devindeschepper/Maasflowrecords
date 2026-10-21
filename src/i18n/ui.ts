import type { Lang } from './index';

/** Texts used on many pages (menu, footer, newsletter, buttons). Page texts live in the pages themselves. */
const en = {
  skip: 'Skip to content',
  tagline: 'Independent Music Label',
  description: 'Maas Flow Records is an independent music label founded by producer and rapper VIN.',
  nav: { '/': 'Home', '/artists/': 'Artists', '/music/': 'Music', '/events/': 'Events', '/services/': 'Services', '/shop/': 'Shop', '/casting/': 'Join' } as Record<string, string>,
  menu: 'Menu',
  mainNav: 'Main',
  language: 'Language',
  cart: 'Shopping cart',
  cartItems: (n: number) => `Shopping cart, ${n} item${n === 1 ? '' : 's'}`,
  studio: { long: 'In the studio', short: 'Studio', off: 'Lights up when VIN is in the studio', offLabel: 'In the studio: off' },
  footer: {
    label: 'Independent music label.',
    contactBtn: 'Contact & bookings',
    nav: 'Footer',
    about: 'About', press: 'Press', contact: 'Contact', cart: 'Cart', shipping: 'Shipping & returns', terms: 'Terms', privacy: 'Privacy',
    follow: 'Follow',
    rights: 'All rights reserved.',
    onSocial: 'Maas Flow Records on',
  },
  newsletter: {
    title: 'Stay connected',
    text: 'New music, release dates and events by email.',
    email: 'Email address',
    placeholder: 'Your email',
    join: 'Join',
    consent: 'I agree to receive emails from Maas Flow Records. Unsubscribe anytime. See our',
    privacy: 'Privacy Policy',
    success: "You're in. Thanks for signing up!",
  },
  form: { website: 'Website' },
};

type Ui = typeof en;

const fr: Ui = {
  skip: 'Aller au contenu',
  tagline: 'Label de musique indépendant',
  description: 'Maas Flow Records est un label de musique indépendant fondé par le producteur et rappeur VIN.',
  nav: { '/': 'Accueil', '/artists/': 'Artistes', '/music/': 'Musique', '/events/': 'Événements', '/services/': 'Services', '/shop/': 'Boutique', '/casting/': 'Nous rejoindre' },
  menu: 'Menu',
  mainNav: 'Principal',
  language: 'Langue',
  cart: 'Panier',
  cartItems: (n) => `Panier, ${n} article${n === 1 ? '' : 's'}`,
  studio: { long: 'Au studio', short: 'Studio', off: "S'allume quand VIN est au studio", offLabel: 'Au studio : éteint' },
  footer: {
    label: 'Label de musique indépendant.',
    contactBtn: 'Contact & bookings',
    nav: 'Pied de page',
    about: 'À propos', press: 'Presse', contact: 'Contact', cart: 'Panier', shipping: 'Livraison & retours', terms: 'CGV', privacy: 'Confidentialité',
    follow: 'Suivre',
    rights: 'Tous droits réservés.',
    onSocial: 'Maas Flow Records sur',
  },
  newsletter: {
    title: 'Reste connecté',
    text: 'Nouvelle musique, dates de sortie et événements par e-mail.',
    email: 'Adresse e-mail',
    placeholder: 'Ton e-mail',
    join: "S'inscrire",
    consent: "J'accepte de recevoir des e-mails de Maas Flow Records. Désinscription à tout moment. Voir notre",
    privacy: 'politique de confidentialité',
    success: "C'est fait. Merci pour ton inscription !",
  },
  form: { website: 'Site web' },
};

const de: Ui = {
  skip: 'Zum Inhalt springen',
  tagline: 'Unabhängiges Musiklabel',
  description: 'Maas Flow Records ist ein unabhängiges Musiklabel, gegründet vom Producer und Rapper VIN.',
  nav: { '/': 'Start', '/artists/': 'Artists', '/music/': 'Musik', '/events/': 'Events', '/services/': 'Services', '/shop/': 'Shop', '/casting/': 'Mitmachen' },
  menu: 'Menü',
  mainNav: 'Hauptmenü',
  language: 'Sprache',
  cart: 'Warenkorb',
  cartItems: (n) => `Warenkorb, ${n} Artikel`,
  studio: { long: 'Im Studio', short: 'Studio', off: 'Leuchtet, wenn VIN im Studio ist', offLabel: 'Im Studio: aus' },
  footer: {
    label: 'Unabhängiges Musiklabel.',
    contactBtn: 'Kontakt & Bookings',
    nav: 'Fußzeile',
    about: 'Über uns', press: 'Presse', contact: 'Kontakt', cart: 'Warenkorb', shipping: 'Versand & Rückgabe', terms: 'AGB', privacy: 'Datenschutz',
    follow: 'Folgen',
    rights: 'Alle Rechte vorbehalten.',
    onSocial: 'Maas Flow Records auf',
  },
  newsletter: {
    title: 'Bleib dran',
    text: 'Neue Musik, Release-Termine und Events per E-Mail.',
    email: 'E-Mail-Adresse',
    placeholder: 'Deine E-Mail',
    join: 'Anmelden',
    consent: 'Ich möchte E-Mails von Maas Flow Records erhalten. Abmeldung jederzeit möglich. Siehe unsere',
    privacy: 'Datenschutzerklärung',
    success: 'Du bist dabei. Danke fürs Anmelden!',
  },
  form: { website: 'Website' },
};

export const ui: Record<Lang, Ui> = { en, fr, de };
