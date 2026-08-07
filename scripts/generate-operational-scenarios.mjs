import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'testing/fake-data/operational-scenarios.json'), 'utf8')
);

function parseArguments(values) {
  const options = { output: resolve(repositoryRoot, '.local/mock-scenarios'), seed: 20260807 };
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    const value = values[index + 1];
    if (argument === '--output') {
      options.output = resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--seed') {
      options.seed = Number(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!Number.isSafeInteger(options.seed) || options.seed < 0) {
    throw new Error('--seed must be a non-negative integer');
  }
  return options;
}

const options = parseArguments(process.argv.slice(2));
mkdirSync(options.output, { recursive: true });

const generated = [];
for (const [scenario, definition] of Object.entries(catalog.scenarios)) {
  const output = resolve(options.output, scenario);
  const result = spawnSync(
    process.execPath,
    [
      resolve(repositoryRoot, 'scripts/generate-mock-csv.mjs'),
      '--scenario',
      scenario,
      '--seed',
      String(options.seed),
      '--output',
      output
    ],
    { cwd: repositoryRoot, encoding: 'utf8', stdio: 'pipe' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `Failed to generate ${scenario}`);
  }
  generated.push({ scenario, rows: definition.defaultRows, directory: scenario });
}

writeFileSync(
  resolve(options.output, 'manifest.json'),
  `${JSON.stringify({
    synthetic: true,
    catalogVersion: catalog.version,
    seed: options.seed,
    generated,
    privacyNotice: catalog.privacyNotice,
    prohibitedUses: catalog.prohibitedUses
  }, null, 2)}\n`
);

process.stdout.write(`Generated ${generated.length} operational scenario packs in ${options.output}\n`);
