# Finishes the picture backup: one bank folder at a time, skipping folders already saved.
# Each folder is copied under a temporary name and only renamed when it fully succeeds, so a
# timeout can never leave a half-copied folder that looks finished. Read-only. Safe to re-run.
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File tools\backup\backup-pictures.ps1
# Optional: -Dir "<backup folder>"  (default: temp\backup\site-backup-<today>)
param([string]$Dir = "temp\backup\site-backup-$(Get-Date -Format yyyy-MM-dd)")
$dest = "$Dir\qbank-images"
New-Item -ItemType Directory -Force $dest | Out-Null
Get-ChildItem $dest -Directory -Filter "*.partial" | Remove-Item -Recurse -Force

$folders = npx supabase storage ls "ss:///qbank-images/" --linked --experimental | ForEach-Object { $_.Trim() } | Where-Object { $_ -like "*/" } | ForEach-Object { $_.TrimEnd("/") }
Write-Host "$($folders.Count) folders in the bucket"
foreach ($f in $folders) {
  if (Test-Path "$dest\$f") { continue }
  for ($i = 1; $i -le 3; $i++) {
    npx supabase storage cp -r "ss:///qbank-images/$f" "$dest\$f.partial" --linked --experimental | Out-Null
    if ($LASTEXITCODE -eq 0) { Move-Item "$dest\$f.partial" "$dest\$f"; break }
    Remove-Item -Recurse -Force "$dest\$f.partial" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 5
  }
  if (Test-Path "$dest\$f") { Write-Host "  saved $f" } else { Write-Host "  FAILED $f" }
}
Write-Host "Done. Check there is no FAILED line above."
