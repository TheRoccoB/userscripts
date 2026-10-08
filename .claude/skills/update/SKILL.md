---
name: update
description: Change an existing userscript in this repo from a plain-English request, then commit, push, wait for raw.githubusercontent.com to serve the new version, and open the install link. Use when the user invokes /update or asks to tweak/fix one of the scripts already in scripts/.
argument-hint: <which script, and what to change, in plain English>
---

# /update

The user wants to change an existing script: $ARGUMENTS

Invoking this skill authorizes the whole loop below, including committing and pushing to `main`. The repo is public and pushing publishes the script, so never put secrets, tokens or personal data in a script.

For brand-new scripts, use `/userscript` instead.

## 1. Pick the script

Match the request against `INDEX.md` (names, descriptions, `@match` sites) and the files in `scripts/`. "the youtube one", "bootcamp script" etc. should resolve on their own. Ask only if two scripts genuinely fit or none does.

## 2. Make the change

Read the whole script first. Follow the code rules in `.claude/skills/userscript/SKILL.md` (section 4): keep the IIFE, `'use strict'`, `@grant`, `@updateURL`/`@downloadURL` as they are; prefix injected ids/classes; one statement per line, braced blocks; short *why* comments. Don't hand-edit `@version` (the pre-commit hook bumps the patch); bump the minor by hand only for a notable change.

If the change depends on the site's DOM and you aren't sure of the selectors, inspect the live page with the Claude in Chrome tools and test the body with `javascript_tool`, as in `/userscript` sections 2 and 5. For small, self-evident edits, skip the browser and say so in the report.

## 3. Commit and push

```sh
git add scripts/<name>.user.js
git commit -m "Update <name>: <what changed>"
git push
```

If the hook fails, fix what it prints and commit again; never use `--no-verify`.

## 4. Wait for the raw CDN

raw.githubusercontent.com can lag a push by a few minutes. Read the version from the committed file (the hook may have bumped it) and poll until the raw URL serves it. Run this with `run_in_background: true` so it doesn't block; you are re-invoked when it exits:

```sh
want=$(grep -m1 '@version' scripts/<name>.user.js)
url="https://raw.githubusercontent.com/TheRoccoB/userscripts/main/scripts/<name>.user.js"
for i in $(seq 1 40); do
    got=$(curl -sS -H 'Cache-Control: no-cache' "$url?nocache=$(date +%s)" | grep -m1 '@version')
    if [ "$got" = "$want" ]; then
        echo "LIVE: $got"
        exit 0
    fi
    sleep 15
done
echo "TIMEOUT after 10 min: still serving '$got', want '$want'"
exit 1
```

Don't open the link before this finishes. If it times out, note that in the report and still open the link.

## 5. Open the install link (always the last action)

Open the raw URL (without the `nocache` param) in a new Chrome tab via the Claude in Chrome tools; no tool calls come after it. Tampermonkey intercepts it and opens its update screen in a separate tab the browser tools can't see, so don't try to click anything; leave the tab open.

## 6. Report

Briefly:
- which script you changed and what changed
- what you tested and what you didn't
- the new version, and whether the CDN confirmed it
- the install link
- that the Tampermonkey tab is open and they should click **Update** / **Reinstall** (or, if they see plain code, Tampermonkey dashboard → **Utilities** → **Import from URL**)
