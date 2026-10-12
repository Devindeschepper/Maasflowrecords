/** Environment variables available to Pages Functions (set in the Cloudflare dashboard). */
export interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  /** Stripe secret key (sk_live_… / sk_test_…) — card, PayPal, Apple/Google Pay. */
  STRIPE_SECRET_KEY?: string;
  /** Signing secret of the Stripe webhook endpoint (whsec_…). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** NOWPayments API key — crypto payments. */
  NOWPAYMENTS_API_KEY?: string;
  /** NOWPayments IPN secret (Settings → Payments → Instant payment notifications). */
  NOWPAYMENTS_IPN_SECRET?: string;
  /** Optional legacy Resend audience id; without it signups go to the account-wide contact list. */
  RESEND_AUDIENCE_ID?: string;
  /** Label's own WhatsApp number in international format (+352…) — receives a ping for every new request. */
  WHATSAPP_PHONE?: string;
  /** CallMeBot API key for that number (sent by CallMeBot on WhatsApp). */
  CALLMEBOT_API_KEY?: string;
  /** KV namespace for the "in the studio" light (binding in wrangler.toml). */
  STUDIO?: KVNamespace;
  /** Shared secret the studio PC sends to switch the light (16+ characters). */
  STUDIO_TOKEN?: string;
  /** D1 database with studio sessions and knocks (binding in wrangler.toml). */
  DB?: D1Database;
}
