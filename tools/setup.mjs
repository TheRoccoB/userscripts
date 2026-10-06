// Installs the pre-commit hook. Run once per clone: npm run setup

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, git } from './lib.mjs';

const HOOK = `#!/bin/sh
# Installed by \`npm run setup\`. The logic lives in tools/pre-commit.mjs.
exec node "$(git rev-parse --show-toplevel)/tools/pre-commit.mjs"
`;

const hooksDir = path.resolve(ROOT, git(['rev-parse', '--git-path', 'hooks']).trim());
const hookPath = path.join(hooksDir, 'pre-commit');

fs.mkdirSync(hooksDir, { recursive: true });
if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, 'utf8');
    if (existing !== HOOK) {
        fs.copyFileSync(hookPath, `${hookPath}.bak`);
        console.log(`Backed up existing hook to ${hookPath}.bak`);
    }
}
fs.writeFileSync(hookPath, HOOK);
fs.chmodSync(hookPath, 0o755);
console.log(`Installed pre-commit hook at ${path.relative(ROOT, hookPath)}`);
