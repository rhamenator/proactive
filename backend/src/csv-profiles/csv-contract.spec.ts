import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jest } from '@jest/globals';
import { parse } from 'csv-parse/sync';
import { CsvProfileDirection } from '../../generated/prisma/client.js';
import { decodeCsvBuffer } from '../common/utils/csv.util.js';
import { CsvProfilesService } from './csv-profiles.service.js';

type ContractProfile = {
  direction: 'import' | 'export';
  columns: string[];
  mapping?: Record<string, string>;
  settings: Record<string, unknown>;
};

type CsvContract = {
  contract: string;
  version: number;
  profiles: Record<string, ContractProfile>;
  legacyAliases: Record<string, string>;
};

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const contract = JSON.parse(
  readFileSync(join(repositoryRoot, 'contracts/csv/proactive-v1.json'), 'utf8')
) as CsvContract;

describe('proactive-csv/v1 contract', () => {
  const prisma = {
    csvProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
  const service = new CsvProfilesService(prisma as never);
  let outputDirectory: string;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.csvProfile.findMany.mockResolvedValue([]);
    prisma.csvProfile.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    if (outputDirectory) {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });

  it('keeps built-in versioned profiles aligned with the machine-readable contract', async () => {
    for (const [code, expected] of Object.entries(contract.profiles)) {
      const direction = expected.direction === 'import' ? CsvProfileDirection.import : CsvProfileDirection.export;
      const profile = await service.resolveProfile({ direction, code });
      expect(profile.settingsJson).toEqual(expect.objectContaining(expected.settings));

      if (direction === CsvProfileDirection.import) {
        expect(profile.mappingJson).toEqual(expected.mapping);
      } else {
        expect(profile.settingsJson?.columns).toEqual(expected.columns);
      }
    }
  });

  it('keeps legacy profile codes compatible with their versioned contracts', async () => {
    for (const [legacyCode, versionedCode] of Object.entries(contract.legacyAliases)) {
      const expected = contract.profiles[versionedCode];
      const direction = expected.direction === 'import' ? CsvProfileDirection.import : CsvProfileDirection.export;
      const legacy = await service.resolveProfile({ direction, code: legacyCode });
      const versioned = await service.resolveProfile({ direction, code: versionedCode });

      expect(legacy.mappingJson).toEqual(versioned.mappingJson);
      expect(legacy.settingsJson?.columns).toEqual(versioned.settingsJson?.columns);
    }
  });

  it('generates deterministic privacy-safe fixtures with contract-exact headers', async () => {
    outputDirectory = await mkdtemp(join(tmpdir(), 'proactive-csv-v1-'));
    execFileSync(
      process.execPath,
      [
        join(repositoryRoot, 'scripts/generate-mock-csv.mjs'),
        '--rows',
        '25',
        '--seed',
        '20260807',
        '--output',
        outputDirectory
      ],
      { cwd: repositoryRoot }
    );

    const importBuffer = readFileSync(join(outputDirectory, 'proactive-turf-import-v1.utf8-bom.csv'));
    expect(importBuffer.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const importRecords = parse(decodeCsvBuffer(importBuffer), { columns: true, bom: true }) as Record<string, string>[];
    expect(Object.keys(importRecords[0])).toEqual(contract.profiles.proactive_turf_import_v1.columns);
    expect(importRecords).toHaveLength(25);

    const windows1252 = readFileSync(join(outputDirectory, 'proactive-turf-import-v1.windows-1252.csv'));
    expect(decodeCsvBuffer(windows1252)).toContain('Café Fixture Way');

    const results = parse(
      decodeCsvBuffer(readFileSync(join(outputDirectory, 'proactive-canvass-results-v1.utf8-bom.csv'))),
      { columns: true, bom: true }
    ) as Record<string, string>[];
    expect(Object.keys(results[0])).toEqual(contract.profiles.proactive_canvass_results_v1.columns);
    expect(results.every((row) => row.van_id.startsWith('MOCK-V-'))).toBe(true);

    const fixtureManifest = JSON.parse(readFileSync(join(outputDirectory, 'manifest.json'), 'utf8'));
    expect(fixtureManifest).toEqual(expect.objectContaining({ synthetic: true, seed: 20260807, rows: 25 }));

    for (const filename of [
      'proactive-turf-import-v1.utf8-bom.csv',
      'proactive-turf-import-v1.windows-1252.csv',
      'proactive-canvass-results-v1.utf8-bom.csv',
      'internal-master-v1.utf8-bom.csv',
      'manifest.json'
    ]) {
      expect(readFileSync(join(outputDirectory, filename))).toEqual(
        readFileSync(join(repositoryRoot, 'examples/csv/proactive-v1', filename))
      );
    }
  });
});
