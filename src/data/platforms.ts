import type { PlatformId } from './types';

/** Display names + icon keys for every supported platform. Order = display order. */
export const platforms: Record<PlatformId, { label: string; kind: 'stream' | 'social' | 'store' }> = {
  spotify: { label: 'Spotify', kind: 'stream' },
  appleMusic: { label: 'Apple Music', kind: 'stream' },
  youtube: { label: 'YouTube', kind: 'social' },
  youtubeMusic: { label: 'YouTube Music', kind: 'stream' },
  soundcloud: { label: 'SoundCloud', kind: 'stream' },
  deezer: { label: 'Deezer', kind: 'stream' },
  tidal: { label: 'TIDAL', kind: 'stream' },
  amazonMusic: { label: 'Amazon Music', kind: 'stream' },
  bandcamp: { label: 'Bandcamp', kind: 'store' },
  beatstars: { label: 'BeatStars', kind: 'store' },
  instagram: { label: 'Instagram', kind: 'social' },
  tiktok: { label: 'TikTok', kind: 'social' },
  facebook: { label: 'Facebook', kind: 'social' },
  x: { label: 'X / Twitter', kind: 'social' },
  twitch: { label: 'Twitch', kind: 'social' },
};

export const platformOrder = Object.keys(platforms) as PlatformId[];
