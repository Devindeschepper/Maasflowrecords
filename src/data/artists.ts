import type { Artist } from './types';

/**
 * Roster. To sign a new artist: add an object here and put a photo in
 * /public/images/artists/. An artist page is generated automatically at /artists/<slug>/.
 */
export const artists: Artist[] = [
  {
    slug: 'vin',
    name: 'VIN',
    roles: ['Producer', 'Rapper', 'Founder'],
    origin: 'Rotterdam, NL',
    tagline: 'Behind the beats and behind the mic.',
    description:
      'Born in Rotterdam, VIN grew up on rap and R&B through his older brother. He started out as a producer about five years ago and later stepped behind the mic. He raps what he lives — and calls himself a student of the game, always learning production, songwriting, recording, mixing and mastering.',
    image: '/images/artists/vin.svg',
    imageAlt: 'Portrait of VIN (placeholder)',
    bioHref: '/bio/#vin',
    // TODO: paste VIN's real profile links. Empty = "coming soon".
    streaming: {
      spotify: '',
      appleMusic: '',
      youtubeMusic: '',
      soundcloud: '',
      deezer: '',
      tidal: '',
      amazonMusic: '',
      beatstars: '',
    },
    socials: {
      instagram: '',
      tiktok: '',
      youtube: '',
    },
  },
];

export const getArtist = (slug: string) => artists.find((a) => a.slug === slug);
