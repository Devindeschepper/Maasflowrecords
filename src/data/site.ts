import settings from '../content/settings.json';
import { cleanLinks } from './clean';

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

/** Label socials (footer, shop page) — edited in the admin panel (/admin → Settings). */
export const labelSocials = cleanLinks(settings.labelSocials);

/**
 * Shop switch (admin panel → Settings). false = the shop shows "Coming soon", the cart is
 * hidden and the checkout API refuses orders.
 */
export const shopOpen: boolean = settings.shopOpen === true;

/**
 * Test mode (admin panel → Settings): shows a "test shop" banner, only accepts Stripe TEST keys
 * (sk_test_…) and uses the NOWPayments sandbox. Nothing is really charged.
 */
export const shopTestMode: boolean = settings.shopTestMode === true;

/**
 * Payment methods offered at checkout (admin panel → Settings).
 * card   = Stripe Checkout: card, PayPal, Apple/Google Pay, Bancontact… (enabled in the Stripe dashboard)
 * crypto = NOWPayments invoice (BTC, ETH, USDT, …)
 * With both off, orders are emailed and the label sends a payment request by hand.
 */
export const paymentMethods = {
  card: settings.acceptCard !== false,
  crypto: settings.acceptCrypto !== false,
};

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/artists/', label: 'Artists' },
  { href: '/music/', label: 'Music' },
  { href: '/events/', label: 'Events' },
  { href: '/casting/', label: 'Casting' },
  { href: '/bio/', label: 'Bio' },
  { href: '/shop/', label: 'Shop' },
];
