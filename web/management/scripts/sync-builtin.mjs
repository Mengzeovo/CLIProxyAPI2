import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const repoRoot = resolve(projectRoot, '..', '..');
const source = resolve(projectRoot, 'dist', 'index.html');
const target = resolve(repoRoot, 'internal', 'managementasset', 'builtin', 'management.html');

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`synced ${source} -> ${target}`);
