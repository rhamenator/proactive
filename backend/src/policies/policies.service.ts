import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { SupervisorScopeMode, type OperationalPolicy } from '@prisma/client';
import { getSensitiveMfaWindowMinutes } from '../auth/sensitive-mfa.util';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PrismaService } from '../prisma/prisma.service';

export type ImportMode = 'create_only' | 'upsert' | 'replace_turf_membership';
export type DuplicateStrategy = 'skip' | 'error' | 'merge' | 'review';
export type PolicySourceScope = 'default' | 'organization' | 'campaign';

export type EffectiveOperationalPolicy = {
  id: string | null;
  organizationId: string | null;
  campaignId: string | null;
  sourceScope: PolicySourceScope;
  explicitRecord: boolean;
  inheritedFromOrganization: boolean;
  defaultImportProfileCode: string;
  defaultImportMode: ImportMode;
  defaultDuplicateStrategy: DuplicateStrategy;
  defaultVanExportProfileCode: string;
  defaultInternalExportProfileCode: string;
  sensitiveMfaWindowMinutes: number;
  canvasserCorrectionWindowMinutes: number;
  maxAttemptsPerHousehold: number;
  minMinutesBetweenAttempts: number;
  geofenceRadiusFeet: number;
  gpsLowAccuracyMeters: number;
  refreshTokenTtlDays: number;
  activationTokenTtlHours: number;
  passwordResetTtlMinutes: number;
  loginLockoutThreshold: number;
  loginLockoutMinutes: number;
  mfaChallengeTtlMinutes: number;
  mfaBackupCodeCount: number;
  retentionArchiveDays: number | null;
  retentionPurgeDays: number | null;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
  supervisorScopeMode: SupervisorScopeMode;
};

type PolicyUpdateInput = Partial<{
  defaultImportProfileCode: string;
  defaultImportMode: ImportMode;
  defaultDuplicateStrategy: DuplicateStrategy;
  defaultVanExportProfileCode: string;
  defaultInternalExportProfileCode: string;
  sensitiveMfaWindowMinutes: number;
  canvasserCorrectionWindowMinutes: number;
  maxAttemptsPerHousehold: number;
  minMinutesBetweenAttempts: number;
  geofenceRadiusFeet: number;
  gpsLowAccuracyMeters: number;
  refreshTokenTtlDays: number;
  activationTokenTtlHours: number;
  passwordResetTtlMinutes: number;
  loginLockoutThreshold: number;
  loginLockoutMinutes: number;
  mfaChallengeTtlMinutes: number;
  mfaBackupCodeCount: number;
  retentionArchiveDays: number | null;
  retentionPurgeDays: number | null;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
  supervisorScopeMode: SupervisorScopeMode;
}>;

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  private getDefaultPolicy(): Omit<EffectiveOperationalPolicy, 'id' | 'organizationId' | 'campaignId' | 'sourceScope' | 'explicitRecord' | 'inheritedFromOrganization'> {
    const archiveDays = Number(process.env.RETENTION_ARCHIVE_DAYS ?? '');
    const purgeDays = Number(process.env.RETENTION_PURGE_DAYS ?? '');

    return {
      defaultImportProfileCode: process.env.DEFAULT_IMPORT_PROFILE_CODE?.trim() || 'van_standard',
      defaultImportMode: this.normalizeImportMode(process.env.DEFAULT_IMPORT_MODE),
      defaultDuplicateStrategy: this.normalizeDuplicateStrategy(process.env.DEFAULT_IMPORT_DUPLICATE_STRATEGY),
      defaultVanExportProfileCode: process.env.DEFAULT_VAN_EXPORT_PROFILE_CODE?.trim() || 'van_compatible',
      defaultInternalExportProfileCode: process.env.DEFAULT_INTERNAL_EXPORT_PROFILE_CODE?.trim() || 'internal_master',
      sensitiveMfaWindowMinutes: this.normalizePositiveInteger(getSensitiveMfaWindowMinutes(), 5, 'sensitiveMfaWindowMinutes'),
      canvasserCorrectionWindowMinutes: this.normalizePositiveInteger(
        process.env.CANVASSER_CORRECTION_WINDOW_MINUTES,
        10,
        'canvasserCorrectionWindowMinutes'
      ),
      maxAttemptsPerHousehold: this.normalizePositiveInteger(
        process.env.MAX_ATTEMPTS_PER_HOUSEHOLD,
        3,
        'maxAttemptsPerHousehold'
      ),
      minMinutesBetweenAttempts: this.normalizePositiveInteger(
        process.env.MIN_MINUTES_BETWEEN_ATTEMPTS,
        5,
        'minMinutesBetweenAttempts'
      ),
      geofenceRadiusFeet: this.normalizePositiveInteger(
        process.env.GEOFENCE_RADIUS_FEET ??
          (process.env.GEOFENCE_RADIUS_METERS
            ? Math.round(Number(process.env.GEOFENCE_RADIUS_METERS) * 3.28084)
            : undefined),
        75,
        'geofenceRadiusFeet'
      ),
      gpsLowAccuracyMeters: this.normalizePositiveInteger(
        process.env.GPS_LOW_ACCURACY_METERS,
        30,
        'gpsLowAccuracyMeters'
      ),
      refreshTokenTtlDays: this.normalizePositiveInteger(process.env.REFRESH_TOKEN_TTL_DAYS, 14, 'refreshTokenTtlDays'),
      activationTokenTtlHours: this.normalizePositiveInteger(
        process.env.ACTIVATION_TOKEN_TTL_HOURS,
        48,
        'activationTokenTtlHours'
      ),
      passwordResetTtlMinutes: this.normalizePositiveInteger(
        process.env.PASSWORD_RESET_TTL_MINUTES,
        30,
        'passwordResetTtlMinutes'
      ),
      loginLockoutThreshold: this.normalizePositiveInteger(
        process.env.LOGIN_LOCKOUT_THRESHOLD,
        5,
        'loginLockoutThreshold'
      ),
      loginLockoutMinutes: this.normalizePositiveInteger(
        process.env.LOGIN_LOCKOUT_MINUTES,
        15,
        'loginLockoutMinutes'
      ),
      mfaChallengeTtlMinutes: this.normalizePositiveInteger(
        process.env.MFA_CHALLENGE_TTL_MINUTES,
        10,
        'mfaChallengeTtlMinutes'
      ),
      mfaBackupCodeCount: this.normalizePositiveInteger(process.env.MFA_BACKUP_CODE_COUNT, 10, 'mfaBackupCodeCount'),
      retentionArchiveDays: Number.isFinite(archiveDays) && archiveDays > 0 ? archiveDays : null,
      retentionPurgeDays: Number.isFinite(purgeDays) && purgeDays > 0 ? purgeDays : null,
      requireArchiveReason: process.env.REQUIRE_ARCHIVE_REASON === 'true',
      allowOrgOutcomeFallback: process.env.ALLOW_ORG_OUTCOME_FALLBACK !== 'false',
      supervisorScopeMode: this.normalizeSupervisorScopeMode(process.env.SUPERVISOR_SCOPE_MODE)
    };
  }

  private normalizeDuplicateStrategy(value: unknown): DuplicateStrategy {
    return value === 'error' || value === 'merge' || value === 'review' ? value : 'skip';
  }

  private normalizeImportMode(value: unknown): ImportMode {
    if (value === 'create_only' || value === 'upsert' || value === 'replace_turf_membership') {
      return value;
    }

    return 'replace_turf_membership';
  }

  private normalizeSupervisorScopeMode(value: unknown): SupervisorScopeMode {
    if (value === SupervisorScopeMode.team || value === SupervisorScopeMode.region) {
      return value;
    }

    return SupervisorScopeMode.team;
  }

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

  private sanitizeNullableDayValue(value: unknown, fieldName: string) {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException(`${fieldName} must be a whole number or null`);
    }

    const rounded = Math.floor(parsed);
    if (rounded <= 0) {
      throw new BadRequestException(`${fieldName} must be greater than zero or null`);
    }

    return rounded;
  }

  private buildScopeKey(organizationId: string, campaignId?: string | null) {
    return `${organizationId}:${campaignId ?? 'org'}`;
  }

  private mapRecord(
    target: { organizationId: string | null; campaignId?: string | null },
    policy: Omit<EffectiveOperationalPolicy, 'id' | 'organizationId' | 'campaignId' | 'sourceScope' | 'explicitRecord' | 'inheritedFromOrganization'>,
    meta: Pick<EffectiveOperationalPolicy, 'id' | 'sourceScope' | 'explicitRecord' | 'inheritedFromOrganization'>
  ): EffectiveOperationalPolicy {
    return {
      id: meta.id,
      organizationId: target.organizationId,
      campaignId: target.campaignId ?? null,
      sourceScope: meta.sourceScope,
      explicitRecord: meta.explicitRecord,
      inheritedFromOrganization: meta.inheritedFromOrganization,
      ...policy
    };
  }

  private mergePolicyRecord(base: ReturnType<PoliciesService['getDefaultPolicy']>, record?: OperationalPolicy | null) {
    if (!record) {
      return base;
    }

    return {
      defaultImportProfileCode: record.defaultImportProfileCode,
      defaultImportMode: this.normalizeImportMode(record.defaultImportMode),
      defaultDuplicateStrategy: this.normalizeDuplicateStrategy(record.defaultDuplicateStrategy),
      defaultVanExportProfileCode: record.defaultVanExportProfileCode,
      defaultInternalExportProfileCode: record.defaultInternalExportProfileCode,
      sensitiveMfaWindowMinutes: this.normalizePositiveInteger(record.sensitiveMfaWindowMinutes, 5, 'sensitiveMfaWindowMinutes'),
      canvasserCorrectionWindowMinutes: this.normalizePositiveInteger(
        record.canvasserCorrectionWindowMinutes,
        10,
        'canvasserCorrectionWindowMinutes'
      ),
      maxAttemptsPerHousehold: this.normalizePositiveInteger(record.maxAttemptsPerHousehold, 3, 'maxAttemptsPerHousehold'),
      minMinutesBetweenAttempts: this.normalizePositiveInteger(
        record.minMinutesBetweenAttempts,
        5,
        'minMinutesBetweenAttempts'
      ),
      geofenceRadiusFeet: this.normalizePositiveInteger(record.geofenceRadiusFeet, 75, 'geofenceRadiusFeet'),
      gpsLowAccuracyMeters: this.normalizePositiveInteger(record.gpsLowAccuracyMeters, 30, 'gpsLowAccuracyMeters'),
      refreshTokenTtlDays: this.normalizePositiveInteger(record.refreshTokenTtlDays, 14, 'refreshTokenTtlDays'),
      activationTokenTtlHours: this.normalizePositiveInteger(record.activationTokenTtlHours, 48, 'activationTokenTtlHours'),
      passwordResetTtlMinutes: this.normalizePositiveInteger(record.passwordResetTtlMinutes, 30, 'passwordResetTtlMinutes'),
      loginLockoutThreshold: this.normalizePositiveInteger(record.loginLockoutThreshold, 5, 'loginLockoutThreshold'),
      loginLockoutMinutes: this.normalizePositiveInteger(record.loginLockoutMinutes, 15, 'loginLockoutMinutes'),
      mfaChallengeTtlMinutes: this.normalizePositiveInteger(record.mfaChallengeTtlMinutes, 10, 'mfaChallengeTtlMinutes'),
      mfaBackupCodeCount: this.normalizePositiveInteger(record.mfaBackupCodeCount, 10, 'mfaBackupCodeCount'),
      retentionArchiveDays: record.retentionArchiveDays ?? null,
      retentionPurgeDays: record.retentionPurgeDays ?? null,
      requireArchiveReason: record.requireArchiveReason,
      allowOrgOutcomeFallback: record.allowOrgOutcomeFallback,
      supervisorScopeMode: this.normalizeSupervisorScopeMode(record.supervisorScopeMode)
    };
  }

  private async findPolicyRecord(organizationId: string, campaignId?: string | null) {
    return this.prisma.operationalPolicy.findUnique({
      where: {
        scopeKey: this.buildScopeKey(organizationId, campaignId)
      }
    });
  }

  async assertCampaignInOrganization(organizationId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        organizationId
      }
    });

    if (!campaign) {
      throw new BadRequestException('Campaign not found in your organization scope');
    }

    return campaign;
  }

  async resolveTargetScope(scope: AccessScope, requestedCampaignId?: string | null) {
    if (!scope.organizationId) {
      throw new BadRequestException('Operational policies require an organization-scoped account');
    }

    if (scope.campaignId) {
      if (requestedCampaignId && requestedCampaignId !== scope.campaignId) {
        throw new ForbiddenException('You cannot manage policies outside your campaign scope');
      }

      return {
        organizationId: scope.organizationId,
        campaignId: scope.campaignId
      };
    }

    if (requestedCampaignId) {
      await this.assertCampaignInOrganization(scope.organizationId, requestedCampaignId);
    }

    return {
      organizationId: scope.organizationId,
      campaignId: requestedCampaignId ?? null
    };
  }

  async getEffectivePolicy(scope: { organizationId?: string | null; campaignId?: string | null }): Promise<EffectiveOperationalPolicy> {
    const defaults = this.getDefaultPolicy();
    if (!scope.organizationId) {
      return this.mapRecord(
        { organizationId: null, campaignId: scope.campaignId ?? null },
        defaults,
        { id: null, sourceScope: 'default', explicitRecord: false, inheritedFromOrganization: false }
      );
    }

    const [campaignPolicy, organizationPolicy] = await Promise.all([
      scope.campaignId ? this.findPolicyRecord(scope.organizationId, scope.campaignId) : Promise.resolve(null),
      this.findPolicyRecord(scope.organizationId, null)
    ]);

    if (campaignPolicy) {
      return this.mapRecord(
        { organizationId: scope.organizationId, campaignId: scope.campaignId ?? null },
        this.mergePolicyRecord(this.mergePolicyRecord(defaults, organizationPolicy), campaignPolicy),
        { id: campaignPolicy.id, sourceScope: 'campaign', explicitRecord: true, inheritedFromOrganization: false }
      );
    }

    if (organizationPolicy) {
      return this.mapRecord(
        { organizationId: scope.organizationId, campaignId: scope.campaignId ?? null },
        this.mergePolicyRecord(defaults, organizationPolicy),
        {
          id: scope.campaignId ? null : organizationPolicy.id,
          sourceScope: 'organization',
          explicitRecord: !scope.campaignId,
          inheritedFromOrganization: Boolean(scope.campaignId)
        }
      );
    }

    return this.mapRecord(
      { organizationId: scope.organizationId, campaignId: scope.campaignId ?? null },
      defaults,
      { id: null, sourceScope: 'default', explicitRecord: false, inheritedFromOrganization: false }
    );
  }

  async getManageablePolicy(scope: AccessScope, requestedCampaignId?: string | null) {
    const targetScope = await this.resolveTargetScope(scope, requestedCampaignId);
    return this.getEffectivePolicy(targetScope);
  }

  async upsertPolicy(scope: AccessScope, input: PolicyUpdateInput & { campaignId?: string | null }) {
    const targetScope = await this.resolveTargetScope(scope, input.campaignId);
    const current = await this.getEffectivePolicy(targetScope);
    const normalizedArchiveDays = this.sanitizeNullableDayValue(input.retentionArchiveDays, 'retentionArchiveDays');
    const normalizedPurgeDays = this.sanitizeNullableDayValue(input.retentionPurgeDays, 'retentionPurgeDays');

    const next = {
      defaultImportProfileCode: input.defaultImportProfileCode?.trim() || current.defaultImportProfileCode,
      defaultImportMode: input.defaultImportMode ?? current.defaultImportMode,
      defaultDuplicateStrategy: input.defaultDuplicateStrategy ?? current.defaultDuplicateStrategy,
      defaultVanExportProfileCode: input.defaultVanExportProfileCode?.trim() || current.defaultVanExportProfileCode,
      defaultInternalExportProfileCode:
        input.defaultInternalExportProfileCode?.trim() || current.defaultInternalExportProfileCode,
      sensitiveMfaWindowMinutes:
        input.sensitiveMfaWindowMinutes === undefined
          ? current.sensitiveMfaWindowMinutes
          : this.normalizePositiveInteger(input.sensitiveMfaWindowMinutes, current.sensitiveMfaWindowMinutes, 'sensitiveMfaWindowMinutes'),
      canvasserCorrectionWindowMinutes:
        input.canvasserCorrectionWindowMinutes === undefined
          ? current.canvasserCorrectionWindowMinutes
          : this.normalizePositiveInteger(
              input.canvasserCorrectionWindowMinutes,
              current.canvasserCorrectionWindowMinutes,
              'canvasserCorrectionWindowMinutes'
            ),
      maxAttemptsPerHousehold:
        input.maxAttemptsPerHousehold === undefined
          ? current.maxAttemptsPerHousehold
          : this.normalizePositiveInteger(input.maxAttemptsPerHousehold, current.maxAttemptsPerHousehold, 'maxAttemptsPerHousehold'),
      minMinutesBetweenAttempts:
        input.minMinutesBetweenAttempts === undefined
          ? current.minMinutesBetweenAttempts
          : this.normalizePositiveInteger(
              input.minMinutesBetweenAttempts,
              current.minMinutesBetweenAttempts,
              'minMinutesBetweenAttempts'
            ),
      geofenceRadiusFeet:
        input.geofenceRadiusFeet === undefined
          ? current.geofenceRadiusFeet
          : this.normalizePositiveInteger(input.geofenceRadiusFeet, current.geofenceRadiusFeet, 'geofenceRadiusFeet'),
      gpsLowAccuracyMeters:
        input.gpsLowAccuracyMeters === undefined
          ? current.gpsLowAccuracyMeters
          : this.normalizePositiveInteger(input.gpsLowAccuracyMeters, current.gpsLowAccuracyMeters, 'gpsLowAccuracyMeters'),
      refreshTokenTtlDays:
        input.refreshTokenTtlDays === undefined
          ? current.refreshTokenTtlDays
          : this.normalizePositiveInteger(input.refreshTokenTtlDays, current.refreshTokenTtlDays, 'refreshTokenTtlDays'),
      activationTokenTtlHours:
        input.activationTokenTtlHours === undefined
          ? current.activationTokenTtlHours
          : this.normalizePositiveInteger(
              input.activationTokenTtlHours,
              current.activationTokenTtlHours,
              'activationTokenTtlHours'
            ),
      passwordResetTtlMinutes:
        input.passwordResetTtlMinutes === undefined
          ? current.passwordResetTtlMinutes
          : this.normalizePositiveInteger(
              input.passwordResetTtlMinutes,
              current.passwordResetTtlMinutes,
              'passwordResetTtlMinutes'
            ),
      loginLockoutThreshold:
        input.loginLockoutThreshold === undefined
          ? current.loginLockoutThreshold
          : this.normalizePositiveInteger(
              input.loginLockoutThreshold,
              current.loginLockoutThreshold,
              'loginLockoutThreshold'
            ),
      loginLockoutMinutes:
        input.loginLockoutMinutes === undefined
          ? current.loginLockoutMinutes
          : this.normalizePositiveInteger(input.loginLockoutMinutes, current.loginLockoutMinutes, 'loginLockoutMinutes'),
      mfaChallengeTtlMinutes:
        input.mfaChallengeTtlMinutes === undefined
          ? current.mfaChallengeTtlMinutes
          : this.normalizePositiveInteger(
              input.mfaChallengeTtlMinutes,
              current.mfaChallengeTtlMinutes,
              'mfaChallengeTtlMinutes'
            ),
      mfaBackupCodeCount:
        input.mfaBackupCodeCount === undefined
          ? current.mfaBackupCodeCount
          : this.normalizePositiveInteger(input.mfaBackupCodeCount, current.mfaBackupCodeCount, 'mfaBackupCodeCount'),
      retentionArchiveDays: normalizedArchiveDays === undefined ? current.retentionArchiveDays : normalizedArchiveDays,
      retentionPurgeDays: normalizedPurgeDays === undefined ? current.retentionPurgeDays : normalizedPurgeDays,
      requireArchiveReason: input.requireArchiveReason ?? current.requireArchiveReason,
      allowOrgOutcomeFallback: input.allowOrgOutcomeFallback ?? current.allowOrgOutcomeFallback,
      supervisorScopeMode: input.supervisorScopeMode ?? current.supervisorScopeMode
    };

    if (next.retentionArchiveDays && next.retentionPurgeDays && next.retentionPurgeDays <= next.retentionArchiveDays) {
      throw new BadRequestException('retentionPurgeDays must be greater than retentionArchiveDays');
    }

    await this.prisma.operationalPolicy.upsert({
      where: {
        scopeKey: this.buildScopeKey(targetScope.organizationId, targetScope.campaignId)
      },
      create: {
        scopeKey: this.buildScopeKey(targetScope.organizationId, targetScope.campaignId),
        organizationId: targetScope.organizationId,
        campaignId: targetScope.campaignId,
        ...next
      },
      update: next
    });

    return this.getEffectivePolicy(targetScope);
  }

  async clearPolicy(scope: AccessScope, requestedCampaignId?: string | null) {
    const targetScope = await this.resolveTargetScope(scope, requestedCampaignId);

    await this.prisma.operationalPolicy.deleteMany({
      where: {
        scopeKey: this.buildScopeKey(targetScope.organizationId, targetScope.campaignId)
      }
    });

    return this.getEffectivePolicy(targetScope);
  }
}
