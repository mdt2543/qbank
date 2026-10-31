# Backs up the choices table one bank at a time (one small query per bank) instead of in numbered
# chunks. Read-only. Run backup-tables.ps1 first so qbanks.part000.json exists. Run from the
# project folder:   powershell -ExecutionPolicy Bypass -File tools\backup\backup-choices.ps1
# Optional: -Dir "<backup folder>"  (default: temp\backup\site-backup-<today>)
param([string]$Dir = "temp\backup\site-backup-$(Get-Date -Format yyyy-MM-dd)")
$dest = "$Dir\tables"
Remove-Item "$dest\choices.*" -Force -ErrorAction SilentlyContinue

$banks = Get-Content "$dest\qbanks.part000.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$total = 0; $i = 0
foreach ($b in $banks) {
  $json = $null
  for ($try = 1; $try -le 3; $try++) {
    $raw = npx supabase db query --linked --output-format json "select c.* from public.choices c join public.questions q on q.id = c.question_id where q.qbank_id = '$($b.id)' order by c.id" | Out-String
    if ($LASTEXITCODE -eq 0 -and $raw.Contains("[")) { $json = $raw.Substring($raw.IndexOf("[")); break }
    Start-Sleep -Seconds 5
  }
  if ($null -eq $json) { Write-Host "  FAILED $($b.slug)"; $i++; continue }
  $n = @($json | ConvertFrom-Json).Count
  $json | Out-File -Encoding utf8 ("$dest\choices.part{0:000}.json" -f $i)
  $total += $n; $i++
  Write-Host "  $($b.slug): $n choices"
}
Set-Content "$dest\choices.done" "ok"
Write-Host "Total choices saved: $total (the site has 8890)"
