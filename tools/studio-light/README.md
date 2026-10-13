# Studio light ("In the studio")

When FL Studio is open on the studio PC, maasflowrecords.com shows a pulsing red **● In the studio** in the header.
It switches off when FL Studio closes, or by itself 15 minutes after the PC goes quiet (crash, no internet).

How it works: Windows Task Scheduler runs `run-hidden.vbs` once a minute → it starts `studio-light.ps1` invisibly →
the script checks if FL Studio is running and, only when something changes (plus a heartbeat every 5 minutes),
sends `on` / `off` to `https://maasflowrecords.com/api/studio`. Each run takes about a second at the lowest
CPU priority and then exits, so nothing stays in memory.

## What it does

- **The sign:** dark normally, glowing red while FL Studio is open. Visitors can click the lit sign to *knock*
  (one knock per visitor per session).
- **Sessions:** opening FL Studio again within 30 minutes of closing it continues the same session.
- **Every Sunday evening**: hours, sessions and knocks of the week, compared with last week.
- **Stats page:** maasflowrecords.com/studio-stats/ (not linked anywhere). Log in with your own `STATS_PASSWORD`
  (a Cloudflare secret you choose, 8+ characters) or the `STUDIO_TOKEN`. After 10 wrong tries it locks for an hour;
  it shows this week / month / all time, the last 12 weeks as a chart and your recent sessions.

## One-time setup in Cloudflare

1. **Storage & databases → Workers KV → Create** a namespace called `STUDIO`, and **D1 SQLite Database → Create**
   one called `maasflow`. Their IDs are in `wrangler.toml` (already done).
2. **Workers & Pages → maasflowrecords2 → Settings → Variables and Secrets → Add** a **Secret**
   `STUDIO_TOKEN` = a long random password (32+ characters, from a password generator). Never share it.
3. Same place, another **Secret**: `STATS_PASSWORD` = your own password for the stats page (8+ characters).

## One-time setup on the studio PC (Windows, about 10 minutes)

1. Make the folder `C:\MaasFlowStudioLight`.
2. Download `studio-light.ps1` and `run-hidden.vbs` from this folder on GitHub
   (open the file → **Download raw file**) and put both in `C:\MaasFlowStudioLight`.
3. Right-click `studio-light.ps1` → **Open with → Notepad**. Replace `PASTE-YOUR-STUDIO-TOKEN-HERE`
   with your `STUDIO_TOKEN` (keep the quotes). Save and close.
4. Press **Windows key**, type `cmd`, open **Command Prompt**, paste this and press Enter:

   ```
   schtasks /Create /TN "Maas Flow Studio Light" /TR "wscript.exe \"C:\MaasFlowStudioLight\run-hidden.vbs\"" /SC MINUTE /MO 1 /F
   ```

   It should say `SUCCESS`.
5. Test: open FL Studio, wait 1–2 minutes, open maasflowrecords.com → the red light is on.
   Close FL Studio → within 1–2 minutes it's off.

## Turn it off / remove it

- Pause: Task Scheduler → **Maas Flow Studio Light** → right-click → **Disable**.
- Remove completely: in Command Prompt run `schtasks /Delete /TN "Maas Flow Studio Light" /F` and delete the folder.

## Troubleshooting

- Light never turns on: check the token in `studio-light.ps1` is exactly the same as `STUDIO_TOKEN` in Cloudflare.
- FL Studio's program name is checked as `FL64`, `FL` or `FL Studio…`. If a new version uses another name,
  open Task Manager → Details while FL is open and add that name in `studio-light.ps1`.

## Followers on the stats page (optional)

`/studio-stats/` shows follower counts with the change over the last 7 days (stats page only, no WhatsApp). Counts are saved once a day (06:00 UTC) and when you open the stats page. Accounts are
listed in `functions/_lib/followers.ts`. Each platform only appears once its key is set as a Cloudflare
**Secret** (Workers & Pages → maasflowrecords2 → Settings → Variables and Secrets).

**YouTube** (VIN, Maas Flow Records, VIN Beats). Secret `YOUTUBE_API_KEY`:
1. console.cloud.google.com → create a project (e.g. "Maas Flow Records").
2. APIs & Services → Library → **YouTube Data API v3** → Enable.
3. APIs & Services → Credentials → Create credentials → **API key**. Edit it → API restrictions →
   YouTube Data API v3 → Save. Copy the key into the secret.

**Instagram** (@vintheartist, @maasflowrecords). Secrets `INSTAGRAM_TOKEN_VIN`, `INSTAGRAM_TOKEN_MFR`:
1. Each account must be a **Professional account** (Instagram → Settings → Account type → Creator or Business).
2. developers.facebook.com → My Apps → **Create app** → use case for the **Instagram API** (Instagram login).
3. In the app: Instagram → **API setup with Instagram login** → Generate access tokens → add the account,
   log in, copy the token. Do this once per account.
4. Tokens normally expire after 60 days; the site refreshes them every Sunday automatically, so you set
   them only once.

Spotify and TikTok are left out: their APIs don't (reliably) share follower counts with small apps.

## TikTok followers on the stats page (optional)

1. Go to developers.tiktok.com, log in with your TikTok account and create an app (Manage apps → Connect an app).
2. Switch the app to **Sandbox** and add your own TikTok account as a **target user** (no app review needed).
3. Add the products **Login Kit** and the scopes **user.info.basic** and **user.info.stats**.
4. In Login Kit, set the **Redirect URI** to `https://maasflowrecords.com/api/tiktok/callback`.
5. Copy the **Client key** and **Client secret** into Cloudflare (Worker → Settings → Variables and Secrets)
   as secrets `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`. Never paste them anywhere else.
6. Open /studio-stats/ and tap **Connect TikTok** once. After that the count updates by itself.

## Website visitors on the stats page (optional)

Shows visits and page views of the last 7 days (vs the week before), visits per day and the top pages, from
Cloudflare Web Analytics. `CF_ACCOUNT_ID` is already in `wrangler.toml`. Add two **Secrets**:

1. `CF_ANALYTICS_TOKEN`: Cloudflare → My Profile → **API Tokens** → Create Token → **Create Custom Token** →
   Permissions: **Account → Account Analytics → Read** → Account resources: your account → Create → copy.
2. `CF_WEB_ANALYTICS_SITE`: Cloudflare → **Analytics & Logs → Web Analytics** → open maasflowrecords.com.
   The site tag is in the page address after `siteTag~in=` (a long code of letters and numbers).
