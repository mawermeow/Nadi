import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { build } from 'esbuild';
import { injectManifest } from 'workbox-build';

const workspaceRoot = process.cwd();
const buildIdPath = path.join(workspaceRoot, '.next', 'BUILD_ID');
const swSourcePath = path.join(workspaceRoot, 'service-worker', 'sw.js');
const swDestinationPath = path.join(workspaceRoot, 'public', 'sw.js');

const buildId = (await readFile(buildIdPath, 'utf8')).trim();
const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'nadi-sw-'));
const bundledSwPath = path.join(tempDirectory, 'sw.bundle.js');

await build({
  entryPoints: [swSourcePath],
  bundle: true,
  format: 'iife',
  outfile: bundledSwPath,
  platform: 'browser',
  target: ['chrome109', 'safari16'],
});

try {
  const { count, size, warnings } = await injectManifest({
    swSrc: bundledSwPath,
    swDest: swDestinationPath,
    globDirectory: workspaceRoot,
    globPatterns: [
      '.next/static/**/*.{css,js,woff,woff2,ttf}',
      'public/**/*.{ico,png,svg,webmanifest}',
    ],
    globIgnores: ['public/sw.js'],
    modifyURLPrefix: {
      '.next/': '/_next/',
      'public/': '/',
    },
    additionalManifestEntries: [
      {
        url: '/offline-shell',
        revision: buildId,
      },
    ],
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
  });

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[workbox] ${warning}`);
    }
  }

  console.log(
    `[workbox] injected ${count} precache entries (${size} bytes) into public/sw.js`,
  );
} finally {
  await rm(tempDirectory, {
    recursive: true,
    force: true,
  });
}
