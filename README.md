# MAGXDXTR ADMIN PORTAL

Professional DLL deployment portal — Toji / Jujutsu Kaisen themed, built with
Next.js. Upload a rebuilt `Client.dll`, and the portal hashes it (SHA-256),
commits it, and publishes `version.json` straight to GitHub so the
auto-update loader picks it up automatically.

Everything runs **in the browser**: your GitHub token is sent only to
`api.github.com`, never to any server. That also means Vercel hosts pure
static files — no serverless payload limits — so DLLs up to GitHub's 100 MB
cap work fine.

---

## Features

- **01 · Connect GitHub** — paste a personal access token, owner / repo /
  branch fields prefilled for `xypherbypass-ctrl / SilentAim-Auto-Update-Loader-New`.
  Token can be remembered in the browser (localStorage).
- **02 · Upload Client.dll** — drag & drop or browse, client-side SHA-256
  hash shown live, version field auto-bumps from the published `version.json`.
- **03 · Push to GitHub** — real upload progress bar, two commits
  (`Client.dll` first, then `version.json` — the loader never sees a
  half-published update), animated success state.
- **Live telemetry** — current published version, DLL hash, target repo,
  last publish time.
- **Deployment terminal** — full timestamped log of every step.
- Slow, smooth animations throughout (1.4–1.8 s expo-out reveals, drifting
  cursed-energy orbs, film grain, scanning dropzone, energy-sweep progress).

---

## Run locally

```powershell
npm install
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```powershell
npm install
npx vercel login        # browser login, once
npx vercel --prod       # deploys, gives you the live URL
```

### Option B — GitHub + Vercel dashboard

1. Create a repo for the site: `https://github.com/new` → name
   `MAGXDXTR-ADMIN-PORTAL` (private is fine)
2. Double-click **`push-website.bat`** in this folder (pushes the source)
3. Go to **vercel.com/new** → *Import* → pick that repo → **Deploy**
4. Every future `push-website.bat` + git push re-triggers a deploy if you
   enable Vercel's Git integration

---

## Using the portal

1. Create a token: **github.com/settings/tokens** → *Generate new token
   (classic)* → scope **`repo`** (or a fine-grained token with
   **Contents: Read and Write** on the loader repo only)
2. Paste it into **Connect GitHub** → **Connect**
3. Drop your new `Client.dll` → check the hash → version auto-bumps
4. **Push to GitHub** → done

The loader downloads the new build on its next **CHECK UPDATES** (GitHub's
raw CDN refreshes in ~5 minutes).

---

## Project structure

```
app/
  layout.js        fonts + metadata + favicon
  page.js          renders the portal
  globals.css      full Toji theme + animation system
  icon.ico
components/
  Portal.js        main client portal (state, cards, push flow)
  LogTerminal.js   animated deployment log
lib/
  github.js        GitHub REST layer (hash, contents API, raw version)
push-website.bat   pushes this site's source to GitHub
```
