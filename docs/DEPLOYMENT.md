# Deployment Guide

## Option 1 — Lovable (recommended for first launch)

1. Open the project in Lovable.
2. Click **Publish** in the top-right.
3. Custom domain via Lovable → Settings → Domains.

Backend (database, auth, secrets) is already managed by Lovable Cloud. No infra to provision.

---

## Option 2 — Cloudflare Workers (default build target)

The project's `vite.config.ts` is configured for Cloudflare Workers via TanStack Start.

```bash
bun install
bun run build
npx wrangler deploy
```

Set runtime secrets via:

```bash
npx wrangler secret put PRECORO_API_TOKEN
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# ...etc
```

---

## Option 3 — Azure Static Web Apps + Azure Functions

Best when you want Azure-native hosting with serverless API.

1. Create an **Azure Static Web App** in the Portal, link this GitHub repo.
2. Build config:
   - App location: `/`
   - Output location: `dist`
   - API location: `api` (TanStack server routes will be adapted to Azure Functions)
3. Add app settings (Configuration → Application settings):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PRECORO_API_TOKEN`, `XERO_*`, `AZURE_FOUNDRY_API_KEY`
4. Deploy on push to `main`.

> Note: TanStack Start's Cloudflare adapter is the default. To target Azure Functions you'll need to swap the Vite Start preset. See `docs/AZURE_NOTES.md`.

---

## Option 4 — Azure App Service (full Node SSR)

1. Provision an App Service Plan (Linux, Node 20 LTS).
2. Configure deployment from GitHub Actions:

```yaml
# .github/workflows/azure-appservice.yml
name: Deploy to Azure App Service
on:
  push:
    branches: [main]
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - uses: azure/webapps-deploy@v3
        with:
          app-name: inventory-control
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: .
```

3. App settings (Portal → Configuration): all server-side env vars from `.env.example`.
4. Startup command: `node .output/server/index.mjs` (path depends on adapter).

---

## Option 5 — Docker / Azure Container Apps

```dockerfile
# Dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

Then:

```bash
docker build -t inventory-control .
az containerapp up --name inventory-control --image inventory-control --environment my-env
```

---

## Post-deploy checklist

- [ ] Xero OAuth redirect URI matches deployed domain
- [ ] Precoro API token valid
- [ ] Supabase RLS policies enabled on all tables
- [ ] First admin user created in `user_roles` table
- [ ] `/api/public/*` webhook endpoints reachable
- [ ] Custom domain + HTTPS active