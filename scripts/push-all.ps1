# Push current branch (and optionally tags) to all three mirrors.
# Usage: .\scripts\push-all.ps1            (branch only)
#        .\scripts\push-all.ps1 -Tags      (also push tags)

param([switch]$Tags)
$ErrorActionPreference = "Stop"

$branch = git rev-parse --abbrev-ref HEAD
$existing = git remote

foreach ($remote in @("origin","github2","codeberg")) {
  if ($existing -notcontains $remote) {
    Write-Host "skip $remote (not configured — run .\scripts\setup-remotes.ps1)"
    continue
  }
  Write-Host "==> pushing $branch -> $remote"
  if ($Tags) { git push $remote $branch --tags } else { git push $remote $branch }
}
Write-Host "done."
