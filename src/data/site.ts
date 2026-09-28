import type { Links } from './types';

export const site = {
  name: 'Maas Flow Records',
  shortName: 'MFR',
  url: 'https://maasflowrecords.com',
  email: 'info@maasflowrecords.com',
  city: 'Rotterdam',
  country: 'NL',
  founded: 'Rotterdam, NL',
  description:
    'Maas Flow Records is an independent music label from Rotterdam, founded by producer and rapper VIN. Rap, R&B and beats — made independently.',
  /**
   * Default social preview image (1200x630).
   * TODO: replace with a 1200x630 PNG/JPG (Instagram/Facebook/WhatsApp don't show SVG previews).
   */
  ogImage: '/images/og-default.svg',
};

/**
 * Official label / artist accounts.
 * TODO: paste the real profile URLs. Empty strings are shown as "coming soon".
 * Remove a line to hide that platform everywhere.
 */
export const labelSocials: Links = {
  instagram: '',
  tiktok: '',
  youtube: '',
  facebook: '',
  x: '',
  spotify: '',
  appleMusic: '',
  soundcloud: '',
  beatstars: '',
};

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
