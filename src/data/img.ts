/**
 * `srcset` for a photo in /images/: a phone-sized WebP (made by scripts/optimize-images.mjs after the build)
 * plus the full image. Anything else (external URLs, SVGs) gets no srcset and loads as before.
 */
export function photoSrcset(src: string | undefined): string | undefined {
  if (!src || !/^\/images\/.+\.(jpe?g|png|webp)$/i.test(src)) return undefined;
  return `${src.replace(/\.[^.]+$/, '.w800.webp')} 800w, ${src} 1400w`;
}
