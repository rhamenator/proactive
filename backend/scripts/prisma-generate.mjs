import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const prismaCliPath = path.join(path.dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
const generationOnlyDatabaseUrl = 'postgresql://prisma:prisma@127.0.0.1:1/prisma_generate_only';
const result = spawnSync(process.execPath, [prismaCliPath, 'generate', ...process.argv.slice(2)], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? generationOnlyDatabaseUrl
  },
  stdio: 'inherit'
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
