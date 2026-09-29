import type { Artist } from './types';
import data from '../content/artists.json';
import { cleanLinks, list, opt } from './clean';

/**
 * Roster — edited in the admin panel (/admin → Artists) or in src/content/artists.json.
 * An artist page is generated automatically at /artists/<slug>/.
 */
type RawArtist = (typeof data.artists)[number] & Record<string, unknown>;

export const artists: Artist[] = (data.artists as RawArtist[]).map((a) => ({
  slug: a.slug,
  name: a.name,
  roles: list(a.roles),
  origin: a.origin ?? '',
  tagline: a.tagline ?? '',
  description: a.description ?? '',
  image: a.image,
  imageAlt: opt(a.imageAlt) ?? `Photo of ${a.name}`,
  bioPhoto: opt(a.bioPhoto),
  bioPhotoAlt: opt(a.bioPhotoAlt),
  bioHref: a.slug === 'vin' ? '/bio/#vin' : `/artists/${a.slug}/`,
  streaming: cleanLinks(a.streaming),
  socials: cleanLinks(a.socials),
}));

export const getArtist = (slug: string) => artists.find((a) => a.slug === slug);
