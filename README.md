# Maas Flow Records — website

Official website of **Maas Flow Records**, the independent music label founded by **VIN**.
Live at **https://maasflowrecords.com**.

- **Astro** — static, fast, SEO-friendly pages (no framework JS shipped)
- **Cloudflare Workers** (static assets) — hosting, deployed automatically from GitHub
- **Worker API** (`worker/` + `functions/api/`) — contact form, casting form, shop checkout
- **Cloudflare Turnstile** — spam protection · **Resend** — email delivery

---

## Updating the site (no coding needed)

Use the admin panel at **https://maasflowrecords.com/admin/** — see **[HOW-TO-UPDATE.md](HOW-TO-UPDATE.md)**
for step-by-step instructions (releases, events, artists, shop, socials).

The admin panel (Sveltia CMS, config in `public/admin/config.yml`) edits the content files in
**`src/content/`** and commits them to `main`; Cloudflare rebuilds the site automatically.

| Content | File(s) |
| --- | --- |
| Releases | `src/content/releases/<slug>.json` (file name = URL) |
| Events | `src/content/events/<slug>.json` |
| Artists | `src/content/artists.json` |
| Shop products | `src/content/products.json` (prices in euros) |
| Shop switch + label socials | `src/content/settings.json` |

`src/data/*.ts` loads and cleans these files for the pages (empty links are hidden, dates → "TBA", etc.).

## Project structure

```
src/
  content/      ← all content (edited through /admin)
  data/         ← loaders + types for the content
  components/   ← reusable UI (ReleaseCard, EventCard, ProductCard, PlatformLinks, …)
  layouts/      ← BaseLayout (SEO meta, header, footer)
  pages/        ← one file per page; artists/[slug] and music/[slug] generate detail pages
  scripts/      ← small browser scripts (cart, forms)
  styles/       ← global design tokens
functions/
  api/contact.ts   ← POST /api/contact
  api/casting.ts   ← POST /api/casting  (with optional file upload, max 10 MB)
  api/checkout.ts  ← POST /api/checkout (re-prices the cart server-side)
  api/subscribe.ts ← POST /api/subscribe (newsletter signup → Resend Audience)
  api/booking.ts   ← POST /api/booking ("Book an artist" form on the Events page)
  _lib/payments/   ← payment provider adapters (currently "manual")
public/           ← static files: images, favicon, _headers (security), robots.txt
```

## Local development

```bash
npm install
npm run dev            # http://localhost:4321  (pages only)
npm run build          # production build → dist/ (then shrinks images in dist/images, max 1400px)
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
   | `CONTACT_FROM_EMAIL` | Settings → **Variables and Secrets** (**secret**) | `Maas Flow Records <noreply@maasflowrecords.com>` (before the domain is verified in Resend: `Maas Flow Records <onboarding@resend.dev>`) |
   | `RESEND_AUDIENCE_ID` | Settings → **Variables and Secrets** (**secret**) | Optional, legacy: id of a Resend audience. Without it, signups go to the account-wide Resend contact list (API key needs full access); if saving fails, signups are emailed to you |
   Add dashboard values as **Secret**: every deploy from GitHub replaces plain dashboard variables with the
   `[vars]` in `wrangler.toml`, secrets are kept. After changing a **build** variable, start a new build
   (Deployments → Retry build, or push a commit) — `PUBLIC_*` values are baked into the pages at build time.
5. **Turnstile**: Cloudflare dashboard → Turnstile → Add widget → hostnames `maasflowrecords.com` and the
   `*.workers.dev` address of the Worker.
   The **Site Key** (short, public) goes in the build variable `PUBLIC_TURNSTILE_SITE_KEY`; the **Secret Key**
   (long, private) goes in the runtime secret `TURNSTILE_SECRET_KEY`. Swapped keys show the widget as a white
   box with a "Troubleshoot" link.
6. **Resend**: create an account, add & verify the domain `maasflowrecords.com` (DNS records), create an API key.
7. Optional nightly rebuild (keeps "upcoming/past" dates fresh): create a deploy hook in the Worker's build
   settings and add its URL as GitHub secret `CLOUDFLARE_DEPLOY_HOOK`.

The `functions/` folder also works unchanged on Cloudflare **Pages** if you ever switch.

## Shop & payments

The cart runs in the browser; the checkout function re-checks every price, size and stock level
against `src/data/products.ts` so prices can't be manipulated.

The shop sells CDs only and ships from Luxembourg. Shipping prices and VAT live in
`src/content/shop.json` (admin → Shipping & VAT) and are applied by `src/data/vat.ts` in both the cart and
the checkout function: with VAT "included" (17%), EU orders contain Luxembourg VAT and orders outside the EU
are charged ex-VAT; "exempt" charges no VAT (small-business scheme). A zone without a shipping price can't be
ordered to. Note: once EU-wide B2C sales pass €10,000/year, destination-country VAT (OSS) applies. At checkout the customer chooses how to pay (switch each method on/off in
the admin panel → Settings):

| Method | Provider | Secrets (Cloudflare → Worker → Settings → Variables and Secrets) | Webhook |
| --- | --- | --- | --- |
| Card, PayPal, Apple/Google Pay, Bancontact | Stripe Checkout (`functions/_lib/payments/stripe.ts`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | `https://maasflowrecords.com/api/webhooks/stripe` — events `checkout.session.completed`, `checkout.session.async_payment_succeeded` |
| Crypto (BTC, ETH, USDT…) | NOWPayments invoice (`functions/_lib/payments/nowpayments.ts`) | `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET` | set automatically per invoice (`/api/webhooks/crypto`) |

Which Stripe methods appear (card, PayPal, Bancontact, Apple Pay…) is chosen in the Stripe
dashboard → Settings → Payment methods. When a payment is confirmed, the webhook emails a **[PAID]**
order to the label and a confirmation to the customer (needs Resend). Crypto orders also send an
"awaiting payment" email with the shipping address first. With both methods off, orders are emailed
and the label sends a payment request by hand (`manual.ts`). Stock is not lowered automatically —
update it in the admin panel after shipping.

## Security

- No secrets in the code — all keys are Cloudflare environment variables.
- Forms: Turnstile + honeypot + timing check + server-side validation + same-origin check.
- Security headers & Content-Security-Policy in `public/_headers`.
- Form submissions are only emailed to the label; nothing is stored or published.
- No third-party players or trackers: song previews are hosted on the site itself.
