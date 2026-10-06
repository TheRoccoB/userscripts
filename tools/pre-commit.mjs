// Pre-commit hook (installed by `npm run setup`).
//
// 1. For every staged scripts/*.user.js that already exists in HEAD and whose
//    @version did not change, bump the patch version in the index (and in the
//    working tree, so the two don't drift apart).
// 2. Check that each staged script has @updateURL/@downloadURL pointing at main.
// 3. Regenerate INDEX.md from the staged scripts and stage it.
//
// Edits go straight into the index via hash-object/update-index, so partially
// staged files keep their unstaged hunks unstaged.

import fs from 'node:fs';
import path from 'node:path';
import {
    ROOT,
    SCRIPT_PATH_RE,
    bumpPatch,
    formatMetaLine,
    git,
    metaValue,
    parseMeta,
    rawUrl,
    readScripts,
    setVersion,
    tryGit,
} from './lib.mjs';
import { INDEX_FILE, writeIndex } from './index.mjs';

const errors = [];

function stagedScriptPaths() {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
        .split('\0')
        .filter((p) => SCRIPT_PATH_RE.test(p));
}

function writeToIndex(repoPath, source) {
    const entry = git(['ls-files', '-s', '--', repoPath]).trim();
    const mode = entry.split(/\s+/)[0];
    const hash = git(['hash-object', '-w', '--stdin', '--path', repoPath], source).trim();
    git(['update-index', '--cacheinfo', `${mode},${hash},${repoPath}`]);
}

function syncWorkingTree(repoPath, oldVersion, newVersion) {
    const absPath = path.join(ROOT, repoPath);
    if (!fs.existsSync(absPath)) {
        return;
    }
    const source = fs.readFileSync(absPath, 'utf8');
    const meta = parseMeta(source);
    if (!meta || metaValue(meta, 'version') !== oldVersion) {
        console.warn(`  (left working copy of ${repoPath} alone: its @version was already edited)`);
        return;
    }
    fs.writeFileSync(absPath, setVersion(source, newVersion));
}

function bumpIfNeeded(repoPath) {
    const headSource = tryGit(['show', `HEAD:${repoPath}`]);
    if (headSource === null) {
        // New file (or first commit): keep whatever version it starts with.
        return;
    }
    const stagedSource = git(['show', `:${repoPath}`]);
    const headMeta = parseMeta(headSource) || [];
    const stagedMeta = parseMeta(stagedSource);
    if (!stagedMeta) {
        errors.push(`${repoPath}: no ==UserScript== metadata block`);
        return;
    }
    const headVersion = metaValue(headMeta, 'version');
    const stagedVersion = metaValue(stagedMeta, 'version');
    if (!stagedVersion) {
        errors.push(`${repoPath}: missing @version`);
        return;
    }
    if (stagedVersion !== headVersion) {
        return;
    }
    const nextVersion = bumpPatch(stagedVersion);
    if (!nextVersion) {
        errors.push(`${repoPath}: can't auto-bump @version "${stagedVersion}"; bump it by hand`);
        return;
    }
    writeToIndex(repoPath, setVersion(stagedSource, nextVersion));
    syncWorkingTree(repoPath, stagedVersion, nextVersion);
    console.log(`bumped ${repoPath}: ${stagedVersion} -> ${nextVersion}`);
}

function checkUrls(script) {
    if (!script.meta) {
        errors.push(`${script.repoPath}: no ==UserScript== metadata block`);
        return;
    }
    const expected = rawUrl(script.fileName);
    for (const key of ['updateURL', 'downloadURL']) {
        if (metaValue(script.meta, key) !== expected) {
            errors.push(`${script.repoPath}: expected\n      ${formatMetaLine(key, expected)}`);
        }
    }
}

const changedPaths = stagedScriptPaths();
for (const repoPath of changedPaths) {
    bumpIfNeeded(repoPath);
}

for (const script of readScripts({ staged: true })) {
    if (changedPaths.includes(script.repoPath)) {
        checkUrls(script);
    }
}

if (errors.length > 0) {
    console.error('\npre-commit: fix these and commit again:');
    for (const error of errors) {
        console.error(`  - ${error}`);
    }
    process.exit(1);
}

if (writeIndex({ staged: true })) {
    console.log(`regenerated ${INDEX_FILE}`);
}
git(['add', '--', INDEX_FILE]);
