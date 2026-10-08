import settings from '../content/settings.json';
import { cleanLinks } from './clean';

export const site = {
  name: 'Maas Flow Records',
  shortName: 'MFR',
  url: 'https://maasflowrecords.com',
  email: 'info@maasflowrecords.com',
  description:
    'Maas Flow Records is an independent music label founded by producer and rapper VIN.',
  /** Default social preview image (1200x630 JPG — WhatsApp/Instagram/Facebook don't show SVG). */
  ogImage: '/images/og-logo.jpg',
  /** Cloudflare Web Analytics token (admin panel → Settings). Empty = no analytics. */
  analyticsToken: /^[a-f0-9]{32}$/i.test(String(settings.analyticsToken ?? '').trim()) ? String(settings.analyticsToken).trim() : '',
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

/**
 * Cloudflare Turnstile SITE key (public — it is printed in every page anyway). Set in the admin panel
 * (Settings); the build variable PUBLIC_TURNSTILE_SITE_KEY is only a fallback. Site keys are short
 * (0x4AAA…, ~24 characters); the long key with underscores is the SECRET key and never belongs here.
 */
const siteKeyFromSettings = String(settings.turnstileSiteKey ?? '').trim();
export const turnstileSiteKey: string =
  /^0x[A-Za-z0-9_-]{10,40}$/.test(siteKeyFromSettings) ? siteKeyFromSettings : ((import.meta as { env?: Record<string, string | undefined> }).env?.PUBLIC_TURNSTILE_SITE_KEY ?? '') // `?.`: this file is also bundled into the Worker, where import.meta.env does not exist;

export const nav = [
  { href: '/', label: 'Home' },
  { href: '/artists/', label: 'Artists' },
  { href: '/music/', label: 'Music' },
  { href: '/events/', label: 'Events' },
  { href: '/casting/', label: 'Casting' },
  { href: '/services/', label: 'Services' },
  { href: '/shop/', label: 'Shop' },
];
