---
name: userscript
description: Build or change a Tampermonkey userscript in this repo for a site open in Chrome, then commit, push and open the install link. Use when the user asks for a userscript / Tampermonkey script / site tweak, or invokes /userscript.
argument-hint: <site and what the script should do>
---

# /userscript

The user wants a Tampermonkey script: $ARGUMENTS

Invoking this skill authorizes the whole loop below, including committing and pushing to `main`. The repo is public and pushing publishes the script, so never put secrets, tokens or personal data in a script.

Read `README.md` first if you haven't this session; it explains the tooling (`npm run new`, `npm run dev`, the pre-commit hook, `INDEX.md`).

## 1. New script or existing one?

Check `scripts/` and `INDEX.md`. If a script already covers this site and the request fits it, edit that script instead of creating a new one. Ask only if it's genuinely unclear.

## 2. Inspect the live page

Use the Claude in Chrome tools (load them in one ToolSearch call). If more than one browser is connected, the tools require asking the user which one; the Linux Chrome is the one with Tampermonkey set up for local dev.

- Prefer a tab the user already has open on the site (only if they said to use it); otherwise open a new tab.
- Use `read_page`, `find` and `javascript_tool` to find stable hooks: ids, `data-*` attributes, ARIA roles, button text. Avoid generated class names like `css-1x2y3z` or `sc-abc123`.
- Check whether the site is a SPA (client-side navigation, content rendered late). If it is, the script needs a `MutationObserver` and/or URL-change handling, not a one-shot query.
- Look only. Don't submit forms, post, buy or change settings on the user's account while exploring.

## 3. Scaffold

For a new script:

```sh
npm run new -- <kebab-name> '<match-url>'
```

Pick a short, descriptive kebab-case name. Make `@match` as narrow as works (path included, e.g. `https://example.com/app/*`); add more `@match` lines by hand if the site has several hosts (www vs bare).

## 4. Write the script

- Fill in `@description` with one plain sentence; it appears in `INDEX.md`.
- Keep the IIFE and `'use strict'`. Keep `@grant none` unless you need a `GM_*` API, and then grant only that one.
- Keep `@updateURL`/`@downloadURL` exactly as generated. The hook rejects anything else.
- Prefix any ids, classes and CSS you inject (e.g. `rb-` for reactbootcamp) so they can't clash with the site.
- Code style: no over-compaction, one statement per line, always braced blocks, no single-line ifs. Match `scripts/reactbootcamp-fixes.user.js`.
- Short comments on *why* (e.g. "capture phase so it runs before Monaco"), not on what.
- Don't hand-edit `@version` on an existing script; the hook bumps it. Bump the minor version by hand only for a notable change.

## 5. Test in the page

For `@grant none` scripts, run the script body in the page with `javascript_tool` and confirm it does what was asked (take a screenshot). Reload the tab afterwards so the test injection doesn't linger. If something can't be checked this way (e.g. `@run-at document-start` behaviour, `GM_*` APIs), say so in the final message.

If the user wants to keep iterating locally, run `npm run dev -- <name>` (copies a stub to the clipboard) and remind them about "Allow access to file URLs" and disabling the published copy.

## 6. Commit and push

```sh
git add scripts/<name>.user.js
git commit -m "<Add|Update> <name>: <what it does>"
git push
```

The pre-commit hook bumps the patch version of edited scripts and regenerates and stages `INDEX.md`. If the hook fails, fix what it prints and commit again; never use `--no-verify`.

Then wait until the raw URL serves the version you just pushed (the hook may have bumped it, so read it from the committed file). The raw CDN can lag a push by about 5 minutes; poll with a bounded wait instead of opening the link early:

```sh
want=$(grep -m1 '@version' scripts/<name>.user.js)
for i in $(seq 1 24); do
    got=$(curl -sS "https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/<name>.user.js?nocache=$i" | grep -m1 '@version')
    [ "$got" = "$want" ] && { echo "live: $got"; break; }
    sleep 15
done
```

If it still isn't live after the loop, say so in the report and open the link anyway as the last step.

## 7. Report

Give the report before the final step:
- what the script does and which URLs it runs on
- what you tested and what you couldn't
- the version that was pushed
- the install link

## 8. Open the install link (always the last step)

Always end by opening the raw URL in Chrome, in a new tab, after the report and once the version is live. Do this every time, including for updates to existing scripts, and leave the tab open. Tampermonkey intercepts it, and its install/update screen opens in a separate tab that the browser tools can't see. Don't try to click Install yourself; tell the user to click **Install** (or **Update** / **Reinstall**) in that tab. If it shows plain code instead, they can use Tampermonkey dashboard → **Utilities** → **Import from URL**.
