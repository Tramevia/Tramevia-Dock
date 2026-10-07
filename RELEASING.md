# Releasing Tramevia Dock

> **En bref (FR).** Une version = un tag `vX.Y.Z` poussé sur GitHub. Le workflow **Release** fait tout le reste :
> image Docker multi-arch sur `ghcr.io/tramevia/tramevia-dock` (tags `X.Y.Z`, `X.Y`, `X`, `latest`), paquet de mise à jour
> `tramevia-dock-X.Y.Z.tar.gz` + ZIP pour les humains, et la release GitHub (notes tirées de la section `## X.Y.Z` du CHANGELOG).
> Avant : `npm version X.Y.Z --no-git-tag-version`, section CHANGELOG, commit « Release vX.Y.Z » sur `main`, CI verte.
> Un tag `vX.Y.Z-rc.1` sert de répétition : image construite mais jamais publiée, pré-release ignorée par la mise à jour intégrée.
> Les utilisateurs se mettent à jour automatiquement (Railway, Watchtower, installation automatique) : respecte les règles de version
> ci-dessous, ne casse jamais rien dans une version mineure ou corrective. Une release publiée ne se supprime pas et ne se re-tague pas :
> on corrige avec X.Y.(Z+1). La mise en place unique (dépôt public, paquet GHCR public, modèle Railway) est juste en dessous.

## One-time setup (before the first public release)

1. GitHub account(s) with write access: 2FA on.
2. Repo **Settings → General → Releases**: enable **Immutable releases** (assets and tag are locked once published).
3. Organization **Settings → Packages → Package creation**: allow **Public**.
4. Make the repository **public**.
5. Publish the first release (steps below). Then open the package
   (github.com/orgs/Tramevia/packages → tramevia-dock) → **Package settings → Danger Zone → Change visibility → Public**.
   This cannot be undone, and making the repo public does NOT do it for you.
6. Check an anonymous pull: `docker logout ghcr.io && docker pull ghcr.io/tramevia/tramevia-dock:1`
   and `docker buildx imagetools inspect ghcr.io/tramevia/tramevia-dock:1` (expect linux/amd64 and linux/arm64).
7. Create the Railway template (Railway: Deploy a Docker Image `ghcr.io/tramevia/tramevia-dock:X.Y.Z`, variables,
   volume `/data`, domain on port 8787, healthcheck `/healthz`, Auto Updates "minor + patches", then
   **Generate Template from Project**; erase your test `ADMIN_PASSWORD` in the composer). Then replace each
   `<!-- RAILWAY_BUTTON … -->` comment in README.md, README.fr.md, docs/en/cloud.md and docs/fr/cloud.md with the
   button it contains (put the template code in place of `<CODE>`), and remove the "button arrives with the first
   public release" notes next to them.

## Version rules (users update automatically: follow them)

- PATCH x.y.Z: fixes only.
- MINOR x.Y.0: features. Database migrations only append to `MIGRATIONS` and must be safe on existing data.
- MAJOR X.0.0: anything breaking: a removed or renamed env var, a migration an older version can't survive,
  a changed `:run` / loop contract in start.bat or start.sh, an incompatible OBS URL.
  Railway, Watchtower (`:1`) and the in-app automatic install never apply a major version.
- Raising `engines.node` is allowed in a minor version. Zip users are asked to update Node.js first.

## Every release

1. `main` is green in CI.
2. `npm version X.Y.Z --no-git-tag-version`, then add a `## X.Y.Z — <title>` section to CHANGELOG.md.
   The workflow fails without it; that section becomes the release notes.
3. Commit "Release vX.Y.Z" and push to `main`.
4. Optional test run on that same commit: `git tag vX.Y.Z-rc.1 && git push origin vX.Y.Z-rc.1`. This builds the image
   without pushing it and creates a GitHub pre-release that the in-app updater ignores. Try the zip from it.
   (The workflow compares package.json with the tag without its `-rc.N` suffix, so package.json stays `X.Y.Z`.)
5. `git tag vX.Y.Z && git push origin vX.Y.Z`
6. Watch **Actions → Release** (about 5 min). Check that:
   - the release page has `tramevia-dock-X.Y.Z.zip` and `tramevia-dock-X.Y.Z.tar.gz`;
   - GHCR has `X.Y.Z`, `X.Y`, `X` and `latest`.
7. Smoke test on a zip install of the previous version: About → **Check now** → **Install now**.
   It should restart, reconnect, and show "Updated to X.Y.Z".
8. On a MAJOR version: update compose.yaml (`:X`) and the README update notes.
9. On a MINOR or MAJOR version: Railway → Templates → Tramevia Dock → Edit → service source image
   → `ghcr.io/tramevia/tramevia-dock:X.Y.Z` → save, so new deployers start on the current version.

## If a release is broken

- Never delete or re-tag: releases are immutable. Publish X.Y.(Z+1) with the fix as soon as possible.
- Zip installs roll back by themselves only if the new version fails to boot.
  Railway users can "Skip this version". Docker users can pin `:X.Y.Z-1`.
