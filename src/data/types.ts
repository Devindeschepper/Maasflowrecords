// Shared content types. Every page is generated from the files in this folder,
// so adding an artist / release / event / product = adding one object to a list.

export type PlatformId =
  | 'spotify'
  | 'appleMusic'
  | 'youtube'
  | 'youtubeMusic'
  | 'soundcloud'
  | 'deezer'
  | 'tidal'
  | 'amazonMusic'
  | 'beatstars'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'twitch'
  | 'bandcamp';

/** A map of platform -> URL. Leave a platform out (or empty) to hide it. */
export type Links = Partial<Record<PlatformId, string>>;

export interface Artist {
  slug: string;
  name: string;
  roles: string[];
  origin: string;
  /** One or two sentences, used on cards and the artist page. */
  tagline: string;
  description: string;
  /** Main portrait (shown cropped to 4:5, focused on the upper part). */
  image: string;
  imageAlt: string;
  /** Optional second photo for the Bio page. */
  bioPhoto?: string;
  bioPhotoAlt?: string;
  /** Anchor/page that holds the full bio. */
  bioHref: string;
  streaming: Links;
  socials: Links;
}

export type ReleaseType = 'Single' | 'EP' | 'Album' | 'Beat Tape';

export interface Release {
  slug: string;
  title: string;
  /** Artist slugs (see artists.ts). */
  artists: string[];
  type: ReleaseType;
  /** ISO date (YYYY-MM-DD). Future dates are shown as "Upcoming"; leave out for "TBA". */
  releaseDate?: string;
  /** true = the date is planned, not confirmed (shown as "Expected …"). */
  dateTentative?: boolean;
  cover: string;
  description: string;
  tracks?: string[];
  links: Links;
  /**
   * Optional short audio preview (a few seconds of the song), hosted on the site.
   * Put an .mp3 in /public/audio/ and write its path here, e.g. '/audio/what-i-live.mp3'.
   */
  preview?: string;
  featured?: boolean;
  /**
   * false = released before/outside the label: shown only on the artist's page,
   * not in the label catalogue (Music page, home page) and without a catalogue number.
   */
  label?: boolean;
}

export interface LabelEvent {
  slug: string;
  title: string;
  kind: 'Release' | 'Concert' | 'Livestream' | 'Performance' | 'Label event' | 'Listening session' | 'Other';
  /** ISO date-time with timezone offset, e.g. 2026-11-14T20:00:00+01:00. Leave out for "date TBA". */
  start?: string;
  venue: string;
  city: string;
  /** For livestreams: where to watch. */
  online?: boolean;
  /** true = a whole-day event (e.g. a release): no time is shown. */
  allDay?: boolean;
  /** true = the date is planned, not confirmed (shown as "Expected"). */
  dateTentative?: boolean;
  description: string;
  image: string;
  ticketUrl?: string;
  ticketLabel?: string;
}

export type ProductCategory = 'Vinyl' | 'CD' | 'T-Shirt' | 'Hoodie' | 'Cap' | 'Poster' | 'Other';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  /** Price in euro cents (2500 = €25.00). */
  price: number;
  image: string;
  /** Number in stock. 0 = sold out. Use `preorder` for items not yet shipped. */
  stock: number;
  preorder?: boolean;
  sizes?: string[];
  /** Weight class used for shipping. */
  shippingClass: 'small' | 'standard';
}

export interface ShippingZone {
  id: string;
  label: string;
  /** Shipping price in euro cents (VAT included), one charge per order. Missing = not set yet: can't order to this zone. */
  price?: number;
  estimate: string;
  /** false = outside the EU (export, no EU VAT). */
  inEU: boolean;
}
