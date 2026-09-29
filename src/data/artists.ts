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
    image: '/images/artists/vin-stairs-bw.jpg',
    imageAlt: 'VIN leaning against a concrete wall on a staircase, black and white',
    photos: [
      { src: '/images/artists/vin-stairs-bw.jpg', alt: 'VIN on a staircase, black and white' },
      { src: '/images/artists/vin-stairs-blue.jpg', alt: 'VIN in a blue Arizona 36 jersey on a staircase, looking at his phone' },
      { src: '/images/artists/vin-street-blue.jpg', alt: 'VIN in a blue jersey and cargo jeans, standing in front of a glass building' },
    ],
    bioHref: '/bio/#vin',
    // Streaming / store profiles. Add a platform by adding a line; remove a line to hide it.
    streaming: {
      spotify: 'https://open.spotify.com/artist/5bDu5EvUNqdhJfVXYcQiXK',
      appleMusic: 'https://music.apple.com/us/artist/vin/1717180938',
      youtubeMusic: 'https://music.youtube.com/channel/UC8dDWNLNjAxwDzcRoadqSvg',
      beatstars: 'https://www.beatstars.com/devindeschepper48605',
    },
    socials: {
      instagram: 'https://www.instagram.com/vintheartist/',
      tiktok: 'https://www.tiktok.com/@vintheartist010',
      youtube: 'https://www.youtube.com/channel/UC8dDWNLNjAxwDzcRoadqSvg',
    },
  },
];

export const getArtist = (slug: string) => artists.find((a) => a.slug === slug);
