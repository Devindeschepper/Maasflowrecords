/** Environment variables available to Pages Functions (set in the Cloudflare dashboard). */
export interface Env {
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  PAYMENT_PROVIDER?: string;
}
