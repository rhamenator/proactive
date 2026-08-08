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
const ngpVanAdapter = JSON.parse(
  readFileSync(
    join(repositoryRoot, 'contracts/csv/adapters/ngpvan-vancrm-bulk-canvass-results-v1.json'),
    'utf8'
  )
) as {
  contract: string;
  validatedOn: string;
  csv: {
    columns: string[];
    requiredValues: string[];
    columnSources: Record<string, string>;
  };
  excludedFields: string[];
};
const ngpVanJobTemplate = JSON.parse(
  readFileSync(
    join(repositoryRoot, 'contracts/csv/adapters/ngpvan-vancrm-bulk-canvass-results-v1.job-template.json'),
    'utf8'
  )
) as {
  file: { columns: Array<{ name: string }> };
  actions: Array<{ resourceType: string; mappingTypes: Array<{ name: string }> }>;
};

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
  let scenarioOutputDirectory: string;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.csvProfile.findMany.mockResolvedValue([]);
    prisma.csvProfile.findFirst.mockResolvedValue(null);
  });

  afterAll(() => {
    if (outputDirectory) {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
    if (scenarioOutputDirectory) {
      rmSync(scenarioOutputDirectory, { recursive: true, force: true });
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

  it('keeps the NGP VAN CRM adapter and synthetic pass/fail fixtures aligned with its dated contract', async () => {
    const profile = await service.resolveProfile({
      direction: CsvProfileDirection.export,
      code: 'ngpvan_vancrm_bulk_canvass_results_v1'
    });
    expect(ngpVanAdapter).toEqual(expect.objectContaining({
      contract: 'ngpvan-vancrm-bulk-canvass-results',
      validatedOn: '2026-08-07'
    }));
    expect(profile.settingsJson).toEqual(expect.objectContaining({
      columns: ngpVanAdapter.csv.columns,
      columnSources: ngpVanAdapter.csv.columnSources,
      requiredColumns: ngpVanAdapter.csv.requiredValues
    }));
    expect(ngpVanJobTemplate.file.columns.map((column) => column.name)).toEqual(ngpVanAdapter.csv.columns);
    expect(ngpVanJobTemplate.actions[0]).toEqual(expect.objectContaining({
      resourceType: 'Contacts',
      mappingTypes: [expect.objectContaining({ name: 'CanvassResults' })]
    }));
    expect(ngpVanAdapter.excludedFields).toEqual(expect.arrayContaining([
      'notes',
      'gps_status',
      'latitude',
      'longitude',
      'sync_status'
    ]));

    const success = parse(
      decodeCsvBuffer(
        readFileSync(
          join(repositoryRoot, 'testing/fake-data/vendor-adapters/ngpvan-vancrm-bulk-canvass-results-v1.success.csv')
        )
      ),
      { columns: true, bom: true }
    ) as Record<string, string>[];
    expect(Object.keys(success[0])).toEqual(ngpVanAdapter.csv.columns);
    expect(success[0]).toEqual({ VanId: '123456', ResultID: '14', DateCanvassed: '2026-03-28T10:00:00.000Z' });

    const failure = parse(
      decodeCsvBuffer(
        readFileSync(
          join(repositoryRoot, 'testing/fake-data/vendor-adapters/ngpvan-vancrm-bulk-canvass-results-v1.failure.csv')
        )
      ),
      { columns: true, bom: true }
    ) as Record<string, string>[];
    expect(failure[0].VanId).toBe('');
    expect(failure[0].ResultID).not.toMatch(/^[1-9]\d*$/);
    expect(Number.isNaN(Date.parse(failure[0].DateCanvassed))).toBe(true);
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
      { cwd: repositoryRoot, stdio: ['ignore', 'ignore', 'pipe'] }
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

  it('generates machine-verifiable operational scenario packs', async () => {
    scenarioOutputDirectory = await mkdtemp(join(tmpdir(), 'proactive-scenarios-'));
    execFileSync(
      process.execPath,
      [
        join(repositoryRoot, 'scripts/generate-operational-scenarios.mjs'),
        '--seed',
        '20260807',
        '--output',
        scenarioOutputDirectory
      ],
      { cwd: repositoryRoot, stdio: ['ignore', 'ignore', 'pipe'] }
    );

    const aggregate = JSON.parse(readFileSync(join(scenarioOutputDirectory, 'manifest.json'), 'utf8'));
    expect(aggregate).toEqual(expect.objectContaining({ synthetic: true, catalogVersion: 1, seed: 20260807 }));
    expect(aggregate.generated.map((item: { scenario: string }) => item.scenario)).toEqual([
      'clean-lifecycle',
      'duplicate-strategies',
      'encoding-edge-cases',
      'sync-recovery',
      'bounded-high-volume'
    ]);

    const duplicates = parse(
      decodeCsvBuffer(
        readFileSync(join(scenarioOutputDirectory, 'duplicate-strategies/proactive-turf-import-v1.utf8-bom.csv'))
      ),
      { columns: true, bom: true }
    ) as Record<string, string>[];
    expect(duplicates[1]).toEqual(expect.objectContaining({
      address_line1: duplicates[0].address_line1,
      city: duplicates[0].city,
      state: duplicates[0].state,
      zip: duplicates[0].zip,
      van_household_id: duplicates[0].van_household_id,
      van_person_id: duplicates[0].van_person_id,
      van_id: duplicates[0].van_id
    }));

    const encoding = decodeCsvBuffer(
      readFileSync(join(scenarioOutputDirectory, 'encoding-edge-cases/proactive-turf-import-v1.windows-1252.csv'))
    );
    expect(encoding).toContain('Café Fixture Way');
    expect(encoding).toContain('00123');

    const syncRows = parse(
      decodeCsvBuffer(
        readFileSync(join(scenarioOutputDirectory, 'sync-recovery/proactive-canvass-results-v1.utf8-bom.csv'))
      ),
      { columns: true, bom: true }
    ) as Record<string, string>[];
    expect(syncRows.map((row) => row.sync_status)).toEqual(expect.arrayContaining(['pending', 'failed', 'conflict']));

    const highVolume = JSON.parse(
      readFileSync(join(scenarioOutputDirectory, 'bounded-high-volume/manifest.json'), 'utf8')
    );
    expect(highVolume).toEqual(expect.objectContaining({
      rows: 2500,
      synthetic: true,
      expected: expect.objectContaining({ rows: 2500 })
    }));

    const customVolumeDirectory = join(scenarioOutputDirectory, 'custom-volume');
    execFileSync(
      process.execPath,
      [
        join(repositoryRoot, 'scripts/generate-mock-csv.mjs'),
        '--scenario',
        'bounded-high-volume',
        '--rows',
        '10',
        '--output',
        customVolumeDirectory
      ],
      { cwd: repositoryRoot, stdio: ['ignore', 'ignore', 'pipe'] }
    );
    const customVolume = JSON.parse(readFileSync(join(customVolumeDirectory, 'manifest.json'), 'utf8'));
    expect(customVolume.rows).toBe(10);
    expect(customVolume.expected.rows).toBe(10);
  });
});
