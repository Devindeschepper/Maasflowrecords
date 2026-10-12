# Maas Flow Records - studio light helper (Windows).
# Run once a minute by Task Scheduler (see README.md). Checks whether FL Studio is open and
# tells maasflowrecords.com, so the site shows "In the studio". Takes about a second, then exits.

# ---- Fill these in once ------------------------------------------------------------
$Token = 'PASTE-YOUR-STUDIO-TOKEN-HERE'           # same value as STUDIO_TOKEN in Cloudflare
$Url   = 'https://maasflowrecords.com/api/studio'
# -------------------------------------------------------------------------------------

$ErrorActionPreference = 'SilentlyContinue'
(Get-Process -Id $PID).PriorityClass = 'Idle'   # never compete with FL Studio or the audio driver
$stateFile = Join-Path $env:LOCALAPPDATA 'MaasFlowStudioLight.txt'
$heartbeat = 5   # minutes between "still on" messages while FL Studio stays open

$running = [bool](Get-Process -Name 'FL64', 'FL', 'FL Studio*' -ErrorAction SilentlyContinue)

# Last thing we told the website: "on|<time>" or "off|<time>".
$last = (Get-Content $stateFile -ErrorAction SilentlyContinue) -split '\|'
$lastState = $last[0]
$lastTime = [datetime]::MinValue
if ($last.Count -gt 1) { [void][datetime]::TryParse($last[1], [ref]$lastTime) }

$send = $null
if ($running -and ($lastState -ne 'on' -or ((Get-Date) - $lastTime).TotalMinutes -ge $heartbeat)) { $send = 'on' }
elseif (-not $running -and $lastState -eq 'on') { $send = 'off' }
if (-not $send) { exit 0 }

try {
  Invoke-RestMethod -Uri $Url -Method Post -TimeoutSec 10 -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $Token" } -Body (@{ state = $send } | ConvertTo-Json) | Out-Null
  "$send|$((Get-Date).ToString('o'))" | Set-Content $stateFile
} catch {
  # No internet or site unreachable: try again next minute.
}
