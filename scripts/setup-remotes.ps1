# Configure the three git mirror remotes. Run once after cloning.
# Usage:
#   $env:GITHUB_PAT_CUBICZAN = "ghp_xxx"
#   $env:GITHUB_PAT_ZANMAKER = "ghp_yyy"
#   $env:CODEBERG_PAT        = "zzz"
#   .\scripts\setup-remotes.ps1

$ErrorActionPreference = "Stop"

foreach ($v in @("GITHUB_PAT_CUBICZAN","GITHUB_PAT_ZANMAKER","CODEBERG_PAT")) {
  if (-not (Get-Item "env:$v" -ErrorAction SilentlyContinue)) {
    Write-Error "Missing env var: $v"; exit 1
  }
}

$remotes = @{
  origin   = "https://Cubiczan:$($env:GITHUB_PAT_CUBICZAN)@github.com/Cubiczan/inventory-control.git"
  github2  = "https://zan-maker:$($env:GITHUB_PAT_ZANMAKER)@github.com/zan-maker/inventory-control.git"
  codeberg = "https://ShyamDesigan:$($env:CODEBERG_PAT)@codeberg.org/ShyamDesigan/inventory-control.git"
}

$existing = git remote
foreach ($name in $remotes.Keys) {
  if ($existing -contains $name) {
    git remote set-url $name $remotes[$name]
    Write-Host "updated remote: $name"
  } else {
    git remote add $name $remotes[$name]
    Write-Host "added remote:   $name"
  }
}

Write-Host "`nRemotes configured:"
git remote -v | ForEach-Object { $_ -replace '://[^@]+@','://***@' }
