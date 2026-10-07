# Contributing / Contribuer

Thanks for helping! / Merci de ton aide !

## Run locally / Lancer en local

```bash
npm install
npm run demo     # fake accounts and chat, no platform setup needed / faux comptes et chat
npm test
```

Open http://localhost:8787. Requires Node.js ≥ 24.15.

## Guidelines / Règles

- Read [SPEC.md](SPEC.md) first: module contracts, data models, security rules.
- No new runtime dependency without discussion (the app only depends on `ws` and `tiktok-live-connector`).
- No build step, no front-end framework: vanilla ES modules and `public/assets/ui.css` components.
- Every user-facing string must exist in **French and English**.
- Add or update a `node:test` test for any logic change (`test/*.test.js`), mocking `fetch` — never call real platforms in tests.
- Keep changes small and focused; describe what you verified (demo mode, real account, OBS version).

## Adding a platform / Ajouter une plateforme

Create `src/platforms/<id>.js` following the adapter contract (SPEC.md §4), add it to `src/platforms/index.js`,
declare its capabilities honestly, and add the setup steps to the docs.
