import type { Product, ShippingZone } from './types';

/**
 * Shop catalogue. This file is ALSO read by the checkout function on the server,
 * so prices/stock here are the source of truth (the browser can't change them).
 *
 * Prices are in euro cents: 2500 = €25.00.
 * TODO: placeholder products — update names, prices, stock and photos.
 * Product photos go in /public/images/shop/ (square, 1200x1200 recommended).
 */
export const products: Product[] = [
  {
    id: 'btm-vinyl',
    name: '2Real4U — 12" Vinyl',
    category: 'Vinyl',
    description: 'Limited black 12" pressing of the debut EP. Printed inner sleeve with lyrics.',
    price: 2800,
    image: '/images/shop/vinyl.svg',
    stock: 50,
    preorder: true,
    shippingClass: 'standard',
  },
  {
    id: 'btm-cd',
    name: '2Real4U — CD',
    category: 'CD',
    description: 'Digipak CD of the debut EP. Signed copies while stock lasts.',
    price: 1200,
    image: '/images/shop/cd.svg',
    stock: 100,
    preorder: true,
    shippingClass: 'small',
  },
  {
    id: 'mfr-tee-black',
    name: 'Maas Flow Logo Tee — Black',
    category: 'T-Shirt',
    description: 'Heavyweight 240gsm cotton tee, boxy fit. White MFR logo print on chest.',
    price: 3000,
    image: '/images/shop/tee.svg',
    stock: 40,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    shippingClass: 'small',
  },
  {
    id: 'mfr-hoodie-black',
    name: 'Maas Flow Hoodie — Black',
    category: 'Hoodie',
    description: 'Heavyweight brushed-fleece hoodie. Embroidered logo on the chest, print on the back.',
    price: 6000,
    image: '/images/shop/hoodie.svg',
    stock: 25,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    shippingClass: 'standard',
  },
  {
    id: 'mfr-cap',
    name: 'MFR Cap',
    category: 'Cap',
    description: 'Six-panel cotton cap with embroidered MFR monogram. One size, adjustable.',
    price: 2500,
    image: '/images/shop/cap.svg',
    stock: 0,
    shippingClass: 'small',
  },
  {
    id: 'btm-poster',
    name: '2Real4U — Poster A2',
    category: 'Poster',
    description: 'A2 poster on 200gsm matte paper. Shipped rolled in a tube.',
    price: 1500,
    image: '/images/shop/poster.svg',
    stock: 30,
    shippingClass: 'small',
  },
];

export const shippingZones: ShippingZone[] = [
  { id: 'nl', label: 'Netherlands', rates: { small: 495, standard: 695 }, estimate: '1–3 business days' },
  { id: 'eu', label: 'European Union', rates: { small: 995, standard: 1495 }, estimate: '3–7 business days' },
  { id: 'world', label: 'Rest of the world', rates: { small: 1695, standard: 2495 }, estimate: '7–15 business days' },
];

export const MAX_QTY_PER_ITEM = 10;

export const getProduct = (id: string) => products.find((p) => p.id === id);

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
