# userscripts

Personal Tampermonkey userscripts that tweak sites I use.

**[Script index with install links → INDEX.md](INDEX.md)**

## How it works

- Each script is a single file at `scripts/<name>.user.js`. There is no build step: the file in the repo is the file Tampermonkey installs.
- Every script's `@updateURL` and `@downloadURL` point at its raw file on `main`:
  `https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/<name>.user.js`
- Tampermonkey checks that URL periodically (daily by default) and updates when `@version` goes up. To pull an update right away, open the Tampermonkey menu and click *Check for userscript updates*. The raw CDN can lag a push by about 5 minutes.
- The repo must stay **public**: raw URLs of private repos need a token, so installs and updates would break.

Why not GitHub Pages: raw.githubusercontent.com already serves the exact committed file with no deploy step, so Pages would only add a build/deploy delay and another thing to configure. It would be worth it only for a pretty install page or a custom domain.

## Setup (once per clone)

```sh
npm run setup   # installs the pre-commit hook into .git/hooks
```

Node 18+ is the only requirement. There are no npm dependencies.

## Commands

| Command | What it does |
| --- | --- |
| `npm run new -- <name> <match-url>` | Creates `scripts/<name>.user.js` from `templates/userscript.js` with metadata filled in. |
| `npm run dev -- <name>` | Prints a dev stub for the script and copies it to the clipboard. |
| `npm run index` | Regenerates `INDEX.md` (the hook does this for you). |

Example:

```sh
npm run new -- github-tweaks 'https://github.com/*'
```

## Local dev loop

1. `npm run dev -- <name>` prints a stub with the same `@match`/`@grant`/etc. metadata plus
   `@require file:///<absolute path>/scripts/<name>.user.js`, and copies it to the clipboard.
2. In Tampermonkey: dashboard → **+** (new script), paste, save. Do this once.
3. Edit the local file and reload the page. The stub picks up your edits; no reinstall.

Notes:

- **Chrome:** go to `chrome://extensions` → Tampermonkey → **Details** → turn on **Allow access to file URLs**. Without it the `@require file:///…` silently fails to load.
- **Disable the published copy** of the script while the dev stub is enabled, or both will run on the page.
- If you change metadata (`@match`, `@grant`, `@run-at`, …), rerun `npm run dev` and replace the stub; metadata comes from the stub, not the required file.

## Versioning

Tampermonkey only updates when `@version` increases, so the pre-commit hook handles it:

- For each staged `scripts/*.user.js` that already exists in `HEAD` and whose `@version` didn't change, it bumps the patch number (`1.0.0` → `1.0.1`) in the staged copy and in your working copy.
- If you bumped `@version` yourself (say, to `1.1.0`), the hook leaves it alone.
- New scripts keep the version they start with (`1.0.0`).
- It fails the commit if a changed script's `@updateURL`/`@downloadURL` don't match the raw URL on `main`, and prints the lines to use.
- It regenerates `INDEX.md` from the staged scripts and stages it.

Versions are plain semver (`MAJOR.MINOR.PATCH`).

If you commit from a GUI client, make sure `node` is on that client's `PATH`, or the hook will fail.
