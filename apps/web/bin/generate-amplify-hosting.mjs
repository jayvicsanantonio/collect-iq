#!/usr/bin/env node

/* eslint-disable no-undef */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const nextDir = path.join(projectRoot, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const hostingDir = path.join(projectRoot, '.amplify-hosting');
const computeDir = path.join(hostingDir, 'compute', 'default');

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const hasStandalone = await pathExists(standaloneDir);
  if (!hasStandalone) {
    console.error(
      '⚠️  Missing .next/standalone output. Ensure next.config.mjs sets `output: "standalone"` and rerun `next build`.'
    );
    process.exitCode = 1;
    return;
  }

  await fs.rm(hostingDir, {
    recursive: true,
    force: true,
  });
  await fs.mkdir(computeDir, {
    recursive: true,
  });

  await fs.cp(standaloneDir, computeDir, { recursive: true });

  const staticSrc = path.join(nextDir, 'static');
  if (await pathExists(staticSrc)) {
    await fs.cp(staticSrc, path.join(hostingDir, 'static'), {
      recursive: true,
    });
  }

  const nextPackageJsonPath = path.join(
    projectRoot,
    'node_modules',
    'next',
    'package.json'
  );
  const nextPackage = JSON.parse(
    await fs.readFile(nextPackageJsonPath, 'utf8')
  );

  const requiredFilesPath = path.join(nextDir, 'required-server-files.json');
  const requiredServerFiles = JSON.parse(
    await fs.readFile(requiredFilesPath, 'utf8')
  );
  const relativeAppDir = requiredServerFiles.relativeAppDir ?? '';
  const serverEntrySrc = path.join(standaloneDir, relativeAppDir, 'server.js');
  const serverEntryDest = path.join(computeDir, 'server.js');
  if (await pathExists(serverEntrySrc)) {
    await fs.cp(serverEntrySrc, serverEntryDest);
  } else {
    console.warn(
      `⚠️  Expected server entry not found at ${serverEntrySrc}. Amplify compute may fail without it.`
    );
  }

  const imageConfig = requiredServerFiles.config?.images ?? {};
  const sizes = Array.from(
    new Set([...(imageConfig.deviceSizes ?? []), ...(imageConfig.imageSizes ?? [])])
  );

  const deployManifest = {
    version: 1,
    framework: { name: 'nextjs', version: nextPackage.version },
    imageSettings: {
      sizes,
      domains: imageConfig.domains ?? [],
      remotePatterns: imageConfig.remotePatterns ?? [],
      formats: imageConfig.formats ?? [],
      minimumCacheTTL:
        typeof imageConfig.minimumCacheTTL === 'number' ? imageConfig.minimumCacheTTL : 60,
      dangerouslyAllowSVG: Boolean(imageConfig.dangerouslyAllowSVG),
    },
    routes: [
      {
        path: '/_amplify/image',
        target: {
          kind: 'ImageOptimization',
          cacheControl: 'public, max-age=3600, immutable',
        },
      },
      {
        path: '/_next/static/*',
        target: {
          kind: 'Static',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      },
      {
        path: '/_next/image*',
        target: {
          kind: 'Compute',
          src: 'default',
        },
      },
      {
        path: '/api/*',
        target: {
          kind: 'Compute',
          src: 'default',
        },
      },
      {
        path: '/*.*',
        target: {
          kind: 'Static',
          cacheControl: 'public, max-age=0',
        },
        fallback: {
          kind: 'Compute',
          src: 'default',
        },
      },
      {
        path: '/*',
        target: {
          kind: 'Compute',
          src: 'default',
        },
      },
    ],
    computeResources: [
      {
        name: 'default',
        runtime: 'nodejs20.x',
        entrypoint: 'server.js',
      },
    ],
  };

  const manifestPath = path.join(hostingDir, 'deploy-manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(deployManifest, null, 2));

  console.log('✅ Generated Amplify hosting bundle at .amplify-hosting');
}

main().catch((error) => {
  console.error('Failed to generate Amplify hosting bundle:', error);
  process.exitCode = 1;
});
