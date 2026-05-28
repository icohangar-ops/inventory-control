# Git Mirror Setup

This repo is mirrored to three remotes so it survives any single provider outage:

| Remote     | Host       | URL                                                       |
| ---------- | ---------- | --------------------------------------------------------- |
| `origin`   | GitHub     | `https://github.com/Cubiczan/inventory-control.git`       |
| `github2`  | GitHub     | `https://github.com/zan-maker/inventory-control.git`      |
| `codeberg` | Codeberg   | `https://codeberg.org/ShyamDesigan/inventory-control.git` |

## One-time setup

1. Create the three empty repos on each host (no README, no .gitignore — keep them empty).
2. Generate Personal Access Tokens with `repo` (or `write:repository` on Codeberg) scope:
   - GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Codeberg → Settings → Applications → Generate New Token
3. Export them locally (never commit):

**Bash:**
```bash
export GITHUB_PAT_CUBICZAN="ghp_xxx"
export GITHUB_PAT_ZANMAKER="ghp_yyy"
export CODEBERG_PAT="zzz"
```

**PowerShell:**
```powershell
$env:GITHUB_PAT_CUBICZAN = "ghp_xxx"
$env:GITHUB_PAT_ZANMAKER = "ghp_yyy"
$env:CODEBERG_PAT        = "zzz"
```

## Wire remotes

Run once:

**Bash:**
```bash
./scripts/setup-remotes.sh
```

**PowerShell:**
```powershell
.\scripts\setup-remotes.ps1
```

## Push to all mirrors

### Bash
```bash
./scripts/push-all.sh           # pushes current branch to all three
./scripts/push-all.sh --tags    # also push tags
```

### PowerShell
```powershell
.\scripts\push-all.ps1         # pushes current branch to all three
.\scripts\push-all.ps1 -Tags   # also push tags
```

## CI mirror (optional)

Add `.github/workflows/mirror.yml` to auto-mirror on every push to `origin` — see [`mirror.yml`](../.github/workflows/mirror.yml).