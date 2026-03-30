import { CsvProfileDirection } from '@prisma/client';
import { CsvProfilesService } from './csv-profiles.service';

describe('CsvProfilesService', () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.csvProfile.findMany.mockResolvedValue([]);
    prisma.csvProfile.findFirst.mockResolvedValue(null);
  });

  it('falls back to the built-in VAN import profile when no scoped override exists', async () => {
    const profile = await service.resolveProfile({
      direction: CsvProfileDirection.import,
      code: 'van_standard',
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    });

    expect(profile).toEqual(expect.objectContaining({
      direction: CsvProfileDirection.import,
      code: 'van_standard',
      explicitRecord: false,
      sourceScope: 'built_in'
    }));
    expect(profile.mappingJson).toEqual(expect.objectContaining({
      addressLine1: 'address_line1',
      turfName: 'turf_name'
    }));
  });

  it('prefers campaign overrides over organization and built-in profiles', async () => {
    prisma.csvProfile.findMany.mockResolvedValue([
      {
        id: 'org-profile',
        direction: CsvProfileDirection.export,
        code: 'van_compatible',
        name: 'Org VAN',
        description: null,
        organizationId: 'org-1',
        campaignId: null,
        isActive: true,
        mappingJson: null,
        settingsJson: { filenamePrefix: 'org-van' }
      },
      {
        id: 'campaign-profile',
        direction: CsvProfileDirection.export,
        code: 'van_compatible',
        name: 'Campaign VAN',
        description: null,
        organizationId: 'org-1',
        campaignId: 'campaign-1',
        isActive: true,
        mappingJson: null,
        settingsJson: { filenamePrefix: 'campaign-van' }
      }
    ]);

    const profile = await service.resolveProfile({
      direction: CsvProfileDirection.export,
      code: 'van_compatible',
      organizationId: 'org-1',
      campaignId: 'campaign-1'
    });

    expect(profile).toEqual(expect.objectContaining({
      id: 'campaign-profile',
      explicitRecord: true,
      sourceScope: 'campaign',
      name: 'Campaign VAN'
    }));
  });

  it('lists effective profiles for a scope, including built-ins and organization overrides', async () => {
    prisma.csvProfile.findMany.mockResolvedValue([
      {
        id: 'org-import',
        direction: CsvProfileDirection.import,
        code: 'van_standard',
        name: 'Org Import',
        description: 'Org override',
        organizationId: 'org-1',
        campaignId: null,
        isActive: true,
        mappingJson: { addressLine1: 'street' },
        settingsJson: { importMode: 'upsert' }
      }
    ]);

    const profiles = await service.listProfiles(
      { organizationId: 'org-1', campaignId: null },
      CsvProfileDirection.import,
      null
    );

    expect(profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'van_standard',
          name: 'Org Import',
          sourceScope: 'organization',
          explicitRecord: true
        })
      ])
    );
  });
});
