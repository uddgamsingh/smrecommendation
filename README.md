# NiveshLens UI (public)

Static front-end only: HTML/CSS/JS. It contains **no secrets and no analysis logic** - it calls the private
gateway's `/api/*` endpoints. Deployed to GitHub Pages by `.github/workflows/pages.yml`.

## Deploy
1. Settings -> Pages -> Source: **GitHub Actions**.
2. Settings -> Secrets and variables -> Actions -> **Variables** -> add `GATEWAY_URL` = your gateway's https URL.
3. Push to `main`. Then add the Pages origin (e.g. `https://<user>.github.io`) to the gateway's `ALLOWED_ORIGINS`.

Not investment advice. Educational tool; not SEBI-registered.
