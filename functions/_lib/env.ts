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
}
