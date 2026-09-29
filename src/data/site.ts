import type { Links } from './types';

export const site = {
  name: 'Maas Flow Records',
  shortName: 'MFR',
  url: 'https://maasflowrecords.com',
  email: 'info@maasflowrecords.com',
  description:
    'Maas Flow Records is an independent music label founded by producer and rapper VIN. Rap, R&B and beats — made independently.',
  /**
   * Default social preview image (1200x630).
   * TODO: replace with a 1200x630 PNG/JPG (Instagram/Facebook/WhatsApp don't show SVG previews).
   */
  ogImage: '/images/og-default.svg',
};

/**
 * Official label accounts. For now these are VIN's accounts.
 * Add a platform by adding a line (see platforms.ts for the ids); remove a line to hide it.
 */
export const labelSocials: Links = {
  instagram: 'https://www.instagram.com/vintheartist/',
  tiktok: 'https://www.tiktok.com/@vintheartist010',
  youtube: 'https://www.youtube.com/channel/UC8dDWNLNjAxwDzcRoadqSvg',
  spotify: 'https://open.spotify.com/artist/5bDu5EvUNqdhJfVXYcQiXK',
  appleMusic: 'https://music.apple.com/us/artist/vin/1717180938',
  beatstars: 'https://www.beatstars.com/devindeschepper48605',
};

/**
 * Shop switch. false = the shop shows "Coming soon", the cart is hidden and the
 * checkout API refuses orders. Set to true when the first products are ready.
 */
export const shopOpen = false;

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/artists/', label: 'Artists' },
  { href: '/music/', label: 'Music' },
  { href: '/events/', label: 'Events' },
  { href: '/casting/', label: 'Casting' },
  { href: '/shop/', label: 'Shop' },
  { href: '/bio/', label: 'Bio' },
  { href: '/socials/', label: 'Socials' },
  { href: '/contact/', label: 'Contact' },
];
