# Backs up every table in the public schema as JSON (one query per table, up to 5000 rows) and
# the login accounts. Read-only; safe to re-run (finished tables are skipped). Run from the
# project folder:   powershell -ExecutionPolicy Bypass -File tools\backup\backup-tables.ps1
# Optional: -Dir "<backup folder>"  (default: temp\backup\site-backup-<today>)
# The "choices" table is bigger than one query can safely return: use backup-choices.ps1 for it.
param([string]$Dir = "temp\backup\site-backup-$(Get-Date -Format yyyy-MM-dd)")
$dest = "$Dir\tables"
New-Item -ItemType Directory -Force $dest | Out-Null

function Run-Json($sql) {
  for ($i = 1; $i -le 3; $i++) {
    $raw = npx supabase db query --linked --output-format json $sql | Out-String
    if ($LASTEXITCODE -eq 0 -and $raw.Contains("[")) { return $raw.Substring($raw.IndexOf("[")) }
    Start-Sleep -Seconds 5
  }
  return $null
}

$names = (Run-Json "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1" | ConvertFrom-Json) | ForEach-Object { $_.table_name }
foreach ($t in $names) {
  if ($t -eq "choices" -or (Test-Path "$dest\$t.done")) { continue }
  $json = Run-Json "select * from public.""$t"" order by ctid limit 5000"
  if ($null -eq $json) { Write-Host "  FAILED $t"; continue }
  $n = @($json | ConvertFrom-Json).Count
  $json | Out-File -Encoding utf8 "$dest\$t.part000.json"
  if ($n -ge 5000) { Write-Host "  $t : $n rows - MAY BE TRUNCATED, export it in smaller pieces"; continue }
  Set-Content "$dest\$t.done" "ok"
  Write-Host "  $t : $n rows"
}

# Login accounts (emails, password hashes, sign-in times).
$auth = Run-Json "select * from auth.users"
if ($auth) { $auth | Out-File -Encoding utf8 "$Dir\auth-users.json"; Write-Host "  auth.users saved" } else { Write-Host "  FAILED auth.users" }

# Project keys (not in Git).
if (Test-Path ".env.local") { Copy-Item ".env.local" "$Dir\env.local.txt" -Force }
Write-Host "Done. Check there is no FAILED line, then compare with: tools\backup\count-tables.sql"
