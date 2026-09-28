// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site, deployed to Cloudflare Pages.
// Server-side logic (forms, checkout) lives in /functions (Cloudflare Pages Functions).
export default defineConfig({
  site: 'https://maasflowrecords.com',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  // Keep all JS in external files so the Content-Security-Policy in public/_headers
  // doesn't need 'unsafe-inline' for scripts.
  vite: { build: { assetsInlineLimit: 0 } },
  integrations: [
    sitemap({
      filter: (page) => !/\/(cart|thanks)\/?$/.test(page),
    }),
  ],
});
