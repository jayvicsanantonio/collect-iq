/* eslint-env node */
/* global process, console */

import * as esbuild from 'esbuild';
import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find all handler, agent, and orchestration files
const entryPoints = [
  ...glob.sync('src/handlers/**/*.ts', { cwd: __dirname }),
  ...glob.sync('src/agents/**/*.ts', { cwd: __dirname }),
  ...glob.sync('src/orchestration/**/*.ts', { cwd: __dirname }),
];

const buildOptions = {
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  treeShaking: true,
  splitting: false,
  external: ['@aws-sdk/*', 'aws-sdk'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  metafile: true,
  logLevel: 'info',
};

async function build() {
  try {
    const result = await esbuild.build(buildOptions);

    if (result.metafile) {
      const text = await esbuild.analyzeMetafile(result.metafile, {
        verbose: false,
      });
      console.log('\nBundle analysis:');
      console.log(text);
    }

    console.log('\n✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
