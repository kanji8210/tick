---
name: vercel
description: |
  Vercel deployment specialist for the tick React/Vite app.
  Use when asked to deploy to Vercel, configure vercel.json, fix Vercel build failures,
  manage Vercel environment variables, debug preview/production deployments, configure
  SPA rewrites, proxy WordPress GraphQL or REST routes, or troubleshoot Vite apps on Vercel.
  Trigger words: "Vercel", "vercel deploy", "vercel.json", "preview deployment",
  "production deployment", "Vercel env", "Vercel build failed", "rewrites", "SPA fallback".
version: "1.0"
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]
applyTo: "vercel.json, package.json, vite.config.*,*env*,src/**/*.{js,jsx,ts,tsx,css,html}"
---

# Vercel Skill - tick React/Vite App

## Project Context

This skill targets the `tick` workspace, a React/Vite frontend deployed on Vercel.

Current local signals:

- Build command: `npm run build`
- Preview command: `npm run preview`
- Output directory: `dist`
- Vercel config: `vercel.json`
- SPA fallback rewrite: non-asset routes should resolve to `/index.html`
- Backend proxies currently route `/graphql` and `/wp-json/:path*` to the WordPress backend.

## When To Use

Use this skill for requests involving:

- Vercel deployment setup or troubleshooting
- Vercel preview vs production behavior
- `vercel.json` rewrites, redirects, headers, clean URLs, or framework settings
- Vite build/output issues on Vercel
- Environment variables for Vercel projects
- WordPress GraphQL or REST proxy routing through Vercel
- SPA 404s after refresh or direct navigation
- Domain, branch, or production deployment checks

## Workflow

1. Identify the failing surface: local build, Vercel build log, routing, environment, domain, or backend proxy.
2. Read the closest controlling files first: `vercel.json`, `package.json`, `vite.config.*`, and any affected API/client config.
3. Form one local hypothesis and choose the cheapest check:
   - Build issue: run `npm run build`.
   - Lint issue: run `npm run lint`.
   - Routing issue: inspect `vercel.json` rewrite order and test the matching path locally or with the deployed URL if available.
   - Environment issue: check variable names and whether they need the `VITE_` prefix for client-side access.
4. Make the smallest focused edit.
5. Validate with the narrowest command available before expanding scope.

## Vite On Vercel Defaults

For this app, prefer these defaults unless the repo has already changed them:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Development command: `npm run dev`

Vite exposes browser environment variables only when they start with `VITE_`. Never print or commit secret values. If a variable is secret, ask the user to enter it in Vercel dashboard or CLI directly.

## Rewrite Patterns

Keep specific backend proxies before the SPA fallback:

```json
{
  "rewrites": [
    {
      "source": "/graphql",
      "destination": "https://example.com/graphql"
    },
    {
      "source": "/wp-json/:path*",
      "destination": "https://example.com/wp-json/:path*"
    },
    {
      "source": "/((?!assets/).*)",
      "destination": "/index.html"
    }
  ]
}
```

The SPA fallback must come last so it does not swallow backend proxy routes.

## Common Fixes

### Direct Route Refresh Shows 404

Check that `vercel.json` includes a final fallback rewrite to `/index.html` and that backend/API rewrites are listed first.

### Client Environment Variable Is Undefined

Confirm the variable is available in the correct Vercel environment and starts with `VITE_` if read from browser code.

### Build Works Locally But Fails On Vercel

Check Node version assumptions, case-sensitive import paths, missing dependencies, and environment variables. Windows can hide filename case mistakes that Linux builds reject.

### WordPress API Or GraphQL Proxy Fails

Check rewrite destination URLs, CORS behavior from the WordPress host, and whether the path preserves the needed trailing route segments.

## Useful Commands

Run from the `tick` workspace:

```powershell
npm run build
npm run lint
npx vercel --version
npx vercel pull
npx vercel env ls
npx vercel deploy
npx vercel deploy --prod
```

Use `npx vercel env pull .env.local` only when the user is comfortable writing environment values to a local file. Do not display secret values in chat.

## Safety Notes

- Do not commit `.vercel/` project metadata unless the repo already intentionally tracks it.
- Do not expose tokens, API keys, database URLs, or private WordPress credentials.
- Prefer dashboard or direct terminal entry for secrets.
- Keep deployment config changes small and validate with `npm run build` when app code or Vite config changes.