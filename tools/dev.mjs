// Prints a Tampermonkey dev stub for a script and copies it to the clipboard.
// The stub @requires the local file, so every page reload runs your latest edits.
// Usage: npm run dev -- <name>

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { formatMetaLine, parseMeta, resolveScript } from './lib.mjs';

// Keys that only make sense for the published copy.
const DROPPED_KEYS = new Set(['version', 'updateURL', 'downloadURL', 'installURL']);

const arg = process.argv[2];
if (!arg) {
    console.error('Usage: npm run dev -- <name>');
    process.exit(1);
}

const script = resolveScript(arg);
if (!fs.existsSync(script.absPath)) {
    console.error(`No such script: ${script.repoPath}`);
    process.exit(1);
}

const meta = parseMeta(fs.readFileSync(script.absPath, 'utf8'));
if (!meta) {
    console.error(`${script.repoPath} has no ==UserScript== metadata block`);
    process.exit(1);
}

const lines = ['// ==UserScript=='];
for (const entry of meta) {
    if (DROPPED_KEYS.has(entry.key)) {
        continue;
    }
    if (entry.key === 'name') {
        lines.push(formatMetaLine('name', `${entry.value} [dev]`));
        lines.push(formatMetaLine('version', '0.0.0-dev'));
        continue;
    }
    lines.push(formatMetaLine(entry.key, entry.value));
}
lines.push(formatMetaLine('require', pathToFileURL(script.absPath).href));
lines.push('// ==/UserScript==');
lines.push('');
lines.push(`// Dev stub for ${script.repoPath}. The real code is loaded by @require above.`);
lines.push('// Re-run `npm run dev` and reinstall this stub if you change @match/@grant/etc.');
lines.push('');
const stub = lines.join('\n');

function copyToClipboard(text) {
    const candidates = [
        ['wl-copy', []],
        ['xclip', ['-selection', 'clipboard']],
        ['xsel', ['--clipboard', '--input']],
        ['pbcopy', []],
        ['clip.exe', []],
    ];
    for (const [command, args] of candidates) {
        const result = spawnSync(command, args, {
            input: text,
            stdio: ['pipe', 'ignore', 'ignore'],
        });
        if (!result.error && result.status === 0) {
            return command;
        }
    }
    return null;
}

console.log(stub);
const copiedWith = copyToClipboard(stub);
if (copiedWith) {
    console.error(`Copied to clipboard (${copiedWith}). In Tampermonkey: Dashboard > + (new script), paste, save.`);
} else {
    console.error('No clipboard tool found; copy the stub above by hand.');
}
console.error('Remember: disable the published copy of this script while the dev stub is enabled.');
