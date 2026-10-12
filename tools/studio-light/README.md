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
