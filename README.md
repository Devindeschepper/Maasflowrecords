# Maas Flow Records — website

Official website of **Maas Flow Records**, the independent music label founded by **VIN**.
Live at **https://maasflowrecords.com**.

- **Astro** — static, fast, SEO-friendly pages (no framework JS shipped)
- **Cloudflare Workers** (static assets) — hosting, deployed automatically from GitHub
- **Worker API** (`worker/` + `functions/api/`) — contact form, casting form, shop checkout
- **Cloudflare Turnstile** — spam protection · **Resend** — email delivery

---

## Updating the site (no coding needed)

Everything on the site is generated from the files in **`src/data/`**. Edit a file on GitHub
(pencil icon → *Commit changes*) and Cloudflare rebuilds the site in ~1 minute.

| I want to…                         | Edit this file              | Images go in                 |
| ---------------------------------- | --------------------------- | ---------------------------- |
| Add a release (single, EP, album)  | `src/data/releases.ts`      | `public/images/releases/`    |
| Add / change an event              | `src/data/events.ts`        | `public/images/events/`      |
| Add a product / change price/stock | `src/data/products.ts`      | `public/images/shop/`        |
| Add an artist to the label         | `src/data/artists.ts`       | `public/images/artists/`     |
| Add social / streaming links       | `src/data/site.ts`, `src/data/artists.ts` | —              |
| Change shipping prices             | `src/data/products.ts` (`shippingZones`) | —               |

Tips
- Copy an existing entry, paste it, and change the values. Keep the commas and quotes.
- Dates: `'2026-11-20'` (releases), `'2026-12-12T20:00:00+01:00'` (events). Future = "Upcoming", past = "Past" automatically.
- Prices are in **cents**: `2500` = €25.00. `stock: 0` = sold out.
- An empty link (`''`) shows the platform greyed out as "soon". Remove the line to hide it.
- Song preview on a release: put a short clip (a few seconds, .mp3) in `public/audio/` and add
  `preview: '/audio/<file>.mp3'` to the release. A play button appears on the cover.
  (There is deliberately no Spotify player: embedded plays by logged-out visitors don't count as streams,
  so the site sends people to the streaming apps instead.)

## Project structure

```
src/
  data/         ← all content (artists, releases, events, products, socials)
  components/   ← reusable UI (ReleaseCard, EventCard, ProductCard, PlatformLinks, …)
  layouts/      ← BaseLayout (SEO meta, header, footer)
  pages/        ← one file per page; artists/[slug] and music/[slug] generate detail pages
  scripts/      ← small browser scripts (cart, forms)
  styles/       ← global design tokens
functions/
  api/contact.ts   ← POST /api/contact
  api/casting.ts   ← POST /api/casting  (with optional file upload, max 10 MB)
  api/checkout.ts  ← POST /api/checkout (re-prices the cart server-side)
  _lib/payments/   ← payment provider adapters (currently "manual")
public/           ← static files: images, favicon, _headers (security), robots.txt
```

## Local development

```bash
npm install
npm run dev            # http://localhost:4321  (pages only)
npm run build          # production build → dist/
npx wrangler dev       # full site + /api locally, like production (reads .dev.vars)
```

Copy `.env.example` → `.env` and `.dev.vars` for local keys. **Never commit real keys.**

## Deploy: GitHub → Cloudflare (Workers)

The site deploys as a Cloudflare Worker with static assets (`wrangler.toml`):
`npx wrangler deploy` first runs `npm run build` (Astro → `dist/`), then uploads the pages.
Only `/api/*` requests run Worker code (`worker/index.ts` → handlers in `functions/api/`).

1. Cloudflare dashboard → **Create app** → import this GitHub repo (or, on an existing Worker,
   **Settings → Build → Git repository**). Deploy command: `npx wrangler deploy`. Build command: leave empty.
2. The Worker name in the dashboard must match `name` in `wrangler.toml` (currently `maasflowrecords2`).
3. **Settings → Domains & Routes** → add `maasflowrecords.com` and `www.maasflowrecords.com`.
4. Variables:
   | Name | Where | Value |
   | --- | --- | --- |
   | `PUBLIC_TURNSTILE_SITE_KEY` | Settings → Build → **Build variables** | Turnstile site key |
   | `TURNSTILE_SECRET_KEY` | Settings → **Variables and Secrets** (secret) | Turnstile secret key |
   | `RESEND_API_KEY` | Settings → **Variables and Secrets** (secret) | Resend API key |
   | `CONTACT_FROM_EMAIL` | Settings → **Variables and Secrets** (text) | `Maas Flow Records <noreply@maasflowrecords.com>` |
5. **Turnstile**: Cloudflare dashboard → Turnstile → Add widget → domain `maasflowrecords.com`.
6. **Resend**: create an account, add & verify the domain `maasflowrecords.com` (DNS records), create an API key.
7. Optional nightly rebuild (keeps "upcoming/past" dates fresh): create a deploy hook in the Worker's build
   settings and add its URL as GitHub secret `CLOUDFLARE_DEPLOY_HOOK`.

The `functions/` folder also works unchanged on Cloudflare **Pages** if you ever switch.

## Shop & payments

The cart runs in the browser; the checkout function re-checks every price, size and stock level
against `src/data/products.ts` so prices can't be manipulated.

With `PAYMENT_PROVIDER=manual` an order is emailed to the label and the customer gets a confirmation;
the label sends a payment request by hand. To take online payments, add a provider adapter in
`functions/_lib/payments/` (interface in `types.ts`), register it in `index.ts`, add a webhook
function to confirm payment, and switch `PAYMENT_PROVIDER`. Popular choices in NL: Mollie (iDEAL), Stripe, PayPal.
For a larger catalogue, a hosted store (Shopify Starter / Lemon Squeezy / Big Cartel) can also be linked instead.

## Security

- No secrets in the code — all keys are Cloudflare environment variables.
- Forms: Turnstile + honeypot + timing check + server-side validation + same-origin check.
- Security headers & Content-Security-Policy in `public/_headers`.
- Form submissions are only emailed to the label; nothing is stored or published.
- No third-party players or trackers: song previews are hosted on the site itself.
