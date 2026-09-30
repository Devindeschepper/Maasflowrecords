# How to update the Maas Flow Records website

You don't need to code. Everything is done in the **admin panel**:
**https://maasflowrecords.com/admin/**

Every time you press **Save**, the change is saved on GitHub and Cloudflare rebuilds the
site automatically. After **1–2 minutes** it's live. (Refresh the page with Ctrl + F5.)

---

## 1. First time: get your access token (once a year)

The admin panel logs in with a **GitHub token** (a kind of password only for this website).

1. Go to **github.com** → your profile picture → **Settings** → **Developer settings**
   → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Name: `Maas Flow admin`. Expiration: **1 year** (the longest). Write down the date — you
   need to make a new one when it expires.
3. **Repository access** → *Only select repositories* → **Maasflowrecords**.
4. **Permissions** → Repository permissions → **Contents: Read and write**.
5. **Generate token** and copy it. Keep it private (like a password). Save it in your password manager.
6. Open **maasflowrecords.com/admin/** → **Sign In Using Access Token** → paste it.

Your browser remembers you, so you only do this again on a new device or when the token expires.

---

## 2. Add a new release (single / EP / album)

**Releases → New Release**

| Field | What to fill in |
| --- | --- |
| Title | Song or project name |
| Type | Single, EP, Album |
| Artist(s) | `vin` (the artist's URL name) |
| Release date | Pick the date. Empty = "TBA". A future date shows as "Upcoming". |
| Date not confirmed yet | On = shows "Expected …" |
| Released on Maas Flow Records | On for label releases. Off for older music (then it only shows on VIN's page). |
| Cover art | Upload a square image (at least 1000×1000). |
| Streaming links | Paste the Spotify / Apple Music / YouTube link. Empty = hidden. |
| Song preview | Upload a short mp3 (10–30 sec). A play button appears on the cover. |

Press **Save**. Done — it appears on the Music page, the home page and VIN's page.

**Changing the EP date / cover later:** Releases → 2Real4U → change the field → Save.
When the date is final, switch **Date not confirmed yet** off.

---

## 3. Add or change an event

**Events → New Event**

- **Date** empty = shows "Date TBA". **Start time** empty = whole-day event (like a release day).
- **Ticket / info link** + **Button text** (e.g. "Tickets") make a button.
- Past events move to "Past events" by themselves.
- To remove an event: open it → **Delete**.

---

## 4. Artists

**Site → Artists** — change VIN's photo, bio text, music links and socials.
To add a new artist: **Add Artist**, give a **URL name** in lowercase (e.g. `newname`), a name,
photo and links. Their page appears at `/artists/newname/` and they're added to the booking form.

---

## 5. The shop (CDs)

**Site → Shop (CDs)**: name, price (in €), photo, stock (0 = sold out) and pre-order on/off.

**Payments** (Site → Settings):
- **Accept card / iDEAL / PayPal (Stripe)** — the customer pays on Stripe's secure page.
- **Accept crypto (NOWPayments)** — the customer pays in Bitcoin, Ethereum, USDT…

**When someone pays** you get an email **"[PAID] Order MFR-…"** with the address → pack and ship
the CD → lower the stock in the admin panel. (Crypto orders first send "Awaiting crypto payment" —
**don't ship until the [PAID] email arrives**.)

**Open the shop:** Site → Settings → **Shop is open** on → Save.

⚠️ Before turning it on: Stripe and/or NOWPayments accounts must be connected (see README "Shop &
payments"), email (Resend) must work, and your business details (KvK) must be on the site.

---

## 6. Label socials (footer icons)

**Site → Settings → Label socials** — paste links, or empty a field to hide an icon.

---

## Something went wrong?

- **Site doesn't update:** Cloudflare → Workers & Pages → maasflowrecords2 → **Deployments**.
  A red build = copy the build log and ask someone (or an AI assistant) to look at it.
- **Undo a change:** every save is on GitHub (repo → *Commits*). A developer can undo any of them.
- **Can't log in:** your token probably expired → make a new one (step 1).
