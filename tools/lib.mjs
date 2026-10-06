// Shared helpers for the userscript tooling. No dependencies.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SCRIPTS_DIR = path.join(ROOT, 'scripts');
export const BRANCH = 'main';
export const SCRIPT_PATH_RE = /^scripts\/[^/]+\.user\.js$/;

const BLOCK_RE = /\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/;
const META_LINE_RE = /^\s*\/\/\s*@(\S+)(?:\s+(.*?))?\s*$/;
const VERSION_LINE_RE = /^(\s*\/\/\s*@version\s+)(\S+)/m;

export function git(args, input) {
    return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        input: input,
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

export function tryGit(args) {
    try {
        return git(args);
    } catch {
        return null;
    }
}

// Works out owner/name from the origin remote, falling back to package.json.
export function getRepo() {
    let url = tryGit(['remote', 'get-url', 'origin']);
    if (!url) {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
        url = pkg.repository && pkg.repository.url ? pkg.repository.url : '';
    }
    const match = url.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/);
    if (!match) {
        throw new Error(`Could not work out the GitHub repo from "${url.trim()}". Add an origin remote or set "repository" in package.json.`);
    }
    return { owner: match[1], name: match[2] };
}

export function repoHomeUrl() {
    const repo = getRepo();
    return `https://github.com/${repo.owner}/${repo.name}`;
}

export function rawUrl(fileName) {
    const repo = getRepo();
    return `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/${BRANCH}/scripts/${fileName}`;
}

// Returns [{ key, value }] in source order, or null if there is no metadata block.
export function parseMeta(source) {
    const block = source.match(BLOCK_RE);
    if (!block) {
        return null;
    }
    const entries = [];
    for (const line of block[1].split('\n')) {
        const m = line.match(META_LINE_RE);
        if (m) {
            entries.push({ key: m[1], value: m[2] || '' });
        }
    }
    return entries;
}

export function metaValue(entries, key) {
    const entry = entries.find((e) => e.key === key);
    if (!entry) {
        return null;
    }
    return entry.value;
}

export function metaValues(entries, key) {
    return entries.filter((e) => e.key === key).map((e) => e.value);
}

export function formatMetaLine(key, value) {
    const label = `@${key}`.padEnd(14, ' ');
    if (value === '') {
        return `// ${label}`.trimEnd();
    }
    return `// ${label}${value}`;
}

export function setVersion(source, version) {
    return source.replace(VERSION_LINE_RE, (whole, prefix) => {
        return `${prefix}${version}`;
    });
}

// "1.2.3" -> "1.2.4", "1.0" -> "1.0.1". Returns null for anything else.
export function bumpPatch(version) {
    const m = String(version).match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
    if (!m) {
        return null;
    }
    const major = Number(m[1]);
    const minor = Number(m[2] || 0);
    const patch = Number(m[3] || 0);
    return `${major}.${minor}.${patch + 1}`;
}

// Accepts "foo", "foo.user.js" or "scripts/foo.user.js".
export function resolveScript(nameOrPath) {
    const base = path.basename(nameOrPath).replace(/\.user\.js$/, '');
    return {
        name: base,
        fileName: `${base}.user.js`,
        absPath: path.join(SCRIPTS_DIR, `${base}.user.js`),
        repoPath: `scripts/${base}.user.js`,
    };
}

// Lists scripts with their source, either from the working tree or from the git index.
export function readScripts({ staged }) {
    let repoPaths = [];
    if (staged) {
        repoPaths = git(['ls-files', '-z', '--', 'scripts/'])
            .split('\0')
            .filter((p) => SCRIPT_PATH_RE.test(p));
    } else if (fs.existsSync(SCRIPTS_DIR)) {
        repoPaths = fs.readdirSync(SCRIPTS_DIR)
            .filter((f) => f.endsWith('.user.js'))
            .map((f) => `scripts/${f}`);
    }
    repoPaths.sort();

    return repoPaths.map((repoPath) => {
        let source = '';
        if (staged) {
            source = git(['show', `:${repoPath}`]);
        } else {
            source = fs.readFileSync(path.join(ROOT, repoPath), 'utf8');
        }
        return {
            repoPath: repoPath,
            fileName: path.basename(repoPath),
            source: source,
            meta: parseMeta(source),
        };
    });
}
