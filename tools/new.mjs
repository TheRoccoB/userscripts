// Scaffolds a new script from templates/userscript.js.
// Usage: npm run new -- <name> <match-url>
// Example: npm run new -- github-tweaks 'https://github.com/*'

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, rawUrl, repoHomeUrl, resolveScript, tryGit } from './lib.mjs';

const [name, match] = process.argv.slice(2);

if (!name || !match) {
    console.error('Usage: npm run new -- <name> <match-url>');
    console.error("Example: npm run new -- github-tweaks 'https://github.com/*'");
    process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    console.error(`Name "${name}" should be kebab-case, e.g. my-site-fixes`);
    process.exit(1);
}

const script = resolveScript(name);
if (fs.existsSync(script.absPath)) {
    console.error(`${script.repoPath} already exists`);
    process.exit(1);
}

function titleCase(kebab) {
    return kebab
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

let author = tryGit(['config', 'user.name']);
if (author) {
    author = author.trim();
} else {
    author = 'unknown';
}

const values = {
    name: name,
    title: titleCase(name),
    namespace: repoHomeUrl(),
    author: author,
    match: match,
    url: rawUrl(script.fileName),
};

const template = fs.readFileSync(path.join(ROOT, 'templates', 'userscript.js'), 'utf8');
const source = template.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    return values[key];
});

fs.mkdirSync(path.dirname(script.absPath), { recursive: true });
fs.writeFileSync(script.absPath, source);
console.log(`Created ${script.repoPath}`);
console.log(`Next: fill in @description, then \`npm run dev -- ${name}\` to install a local dev stub.`);
