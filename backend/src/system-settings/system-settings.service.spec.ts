import { SystemSettingsService } from './system-settings.service';

describe('SystemSettingsService', () => {
  const prisma = {
    systemConfiguration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn()
    }
  };

  const service = new SystemSettingsService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns environment defaults when no explicit record exists', async () => {
    prisma.systemConfiguration.findUnique.mockResolvedValue(null);

    const result = await service.getEffectiveSettings();

    expect(result).toEqual({
      id: null,
      explicitRecord: false,
      authRateLimitWindowMinutes: 15,
      authRateLimitMaxAttempts: 10,
      retentionJobEnabled: false,
      retentionJobIntervalMinutes: 60
    });
  });

  it('upserts explicit settings and returns the merged result', async () => {
    prisma.systemConfiguration.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'global',
      authRateLimitWindowMinutes: 20,
      authRateLimitMaxAttempts: 12,
      retentionJobEnabled: true,
      retentionJobIntervalMinutes: 30
    });
    prisma.systemConfiguration.upsert.mockResolvedValue({ id: 'global' });

    const result = await service.upsertSettings({
      authRateLimitWindowMinutes: 20,
      authRateLimitMaxAttempts: 12,
      retentionJobEnabled: true,
      retentionJobIntervalMinutes: 30
    });

    expect(prisma.systemConfiguration.upsert).toHaveBeenCalledWith({
      where: { id: 'global' },
      create: {
        id: 'global',
        authRateLimitWindowMinutes: 20,
        authRateLimitMaxAttempts: 12,
        retentionJobEnabled: true,
        retentionJobIntervalMinutes: 30
      },
      update: {
        authRateLimitWindowMinutes: 20,
        authRateLimitMaxAttempts: 12,
        retentionJobEnabled: true,
        retentionJobIntervalMinutes: 30
      }
    });
    expect(result.explicitRecord).toBe(true);
  });
});
