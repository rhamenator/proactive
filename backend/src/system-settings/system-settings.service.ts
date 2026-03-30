import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type EffectiveSystemSettings = {
  id: string | null;
  explicitRecord: boolean;
  authRateLimitWindowMinutes: number;
  authRateLimitMaxAttempts: number;
  retentionJobEnabled: boolean;
  retentionJobIntervalMinutes: number;
};

type UpdateSystemSettingsInput = Partial<{
  authRateLimitWindowMinutes: number;
  authRateLimitMaxAttempts: number;
  retentionJobEnabled: boolean;
  retentionJobIntervalMinutes: number;
}>;

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePositiveInteger(value: unknown, fallback: number, fieldName: string) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    const rounded = Math.floor(parsed);
    if (rounded <= 0) {
      throw new BadRequestException(`${fieldName} must be greater than zero`);
    }

    return rounded;
  }

  private getDefaultSettings(): Omit<EffectiveSystemSettings, 'id' | 'explicitRecord'> {
    return {
      authRateLimitWindowMinutes: this.normalizePositiveInteger(
        process.env.AUTH_RATE_LIMIT_WINDOW_MS
          ? Math.round(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) / 60000)
          : undefined,
        15,
        'authRateLimitWindowMinutes'
      ),
      authRateLimitMaxAttempts: this.normalizePositiveInteger(
        process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS,
        10,
        'authRateLimitMaxAttempts'
      ),
      retentionJobEnabled: process.env.RETENTION_JOB_ENABLED === 'true',
      retentionJobIntervalMinutes: this.normalizePositiveInteger(
        process.env.RETENTION_JOB_INTERVAL_MINUTES,
        60,
        'retentionJobIntervalMinutes'
      )
    };
  }

  async getEffectiveSettings(): Promise<EffectiveSystemSettings> {
    const defaults = this.getDefaultSettings();
    const record = await this.prisma.systemConfiguration.findUnique({
      where: { id: 'global' }
    });

    if (!record) {
      return {
        id: null,
        explicitRecord: false,
        ...defaults
      };
    }

    return {
      id: record.id,
      explicitRecord: true,
      authRateLimitWindowMinutes: this.normalizePositiveInteger(
        record.authRateLimitWindowMinutes,
        defaults.authRateLimitWindowMinutes,
        'authRateLimitWindowMinutes'
      ),
      authRateLimitMaxAttempts: this.normalizePositiveInteger(
        record.authRateLimitMaxAttempts,
        defaults.authRateLimitMaxAttempts,
        'authRateLimitMaxAttempts'
      ),
      retentionJobEnabled: record.retentionJobEnabled,
      retentionJobIntervalMinutes: this.normalizePositiveInteger(
        record.retentionJobIntervalMinutes,
        defaults.retentionJobIntervalMinutes,
        'retentionJobIntervalMinutes'
      )
    };
  }

  async upsertSettings(input: UpdateSystemSettingsInput) {
    const current = await this.getEffectiveSettings();
    const next = {
      authRateLimitWindowMinutes:
        input.authRateLimitWindowMinutes === undefined
          ? current.authRateLimitWindowMinutes
          : this.normalizePositiveInteger(
              input.authRateLimitWindowMinutes,
              current.authRateLimitWindowMinutes,
              'authRateLimitWindowMinutes'
            ),
      authRateLimitMaxAttempts:
        input.authRateLimitMaxAttempts === undefined
          ? current.authRateLimitMaxAttempts
          : this.normalizePositiveInteger(
              input.authRateLimitMaxAttempts,
              current.authRateLimitMaxAttempts,
              'authRateLimitMaxAttempts'
            ),
      retentionJobEnabled: input.retentionJobEnabled ?? current.retentionJobEnabled,
      retentionJobIntervalMinutes:
        input.retentionJobIntervalMinutes === undefined
          ? current.retentionJobIntervalMinutes
          : this.normalizePositiveInteger(
              input.retentionJobIntervalMinutes,
              current.retentionJobIntervalMinutes,
              'retentionJobIntervalMinutes'
            )
    };

    await this.prisma.systemConfiguration.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        ...next
      },
      update: next
    });

    return this.getEffectiveSettings();
  }

  async clearSettings() {
    await this.prisma.systemConfiguration.deleteMany({
      where: { id: 'global' }
    });

    return this.getEffectiveSettings();
  }
}
