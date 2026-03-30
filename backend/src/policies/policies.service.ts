import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import type { OperationalPolicy } from '@prisma/client';
import { getSensitiveMfaWindowMinutes } from '../auth/sensitive-mfa.util';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PrismaService } from '../prisma/prisma.service';

export type ImportMode = 'create_only' | 'upsert';
export type DuplicateStrategy = 'skip' | 'error' | 'merge';
export type PolicySourceScope = 'default' | 'organization' | 'campaign';

export type EffectiveOperationalPolicy = {
  id: string | null;
  organizationId: string | null;
  campaignId: string | null;
  sourceScope: PolicySourceScope;
  explicitRecord: boolean;
  inheritedFromOrganization: boolean;
  defaultImportMode: ImportMode;
  defaultDuplicateStrategy: DuplicateStrategy;
  sensitiveMfaWindowMinutes: number;
  retentionArchiveDays: number | null;
  retentionPurgeDays: number | null;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
};

type PolicyUpdateInput = Partial<{
  defaultImportMode: ImportMode;
  defaultDuplicateStrategy: DuplicateStrategy;
  sensitiveMfaWindowMinutes: number;
  retentionArchiveDays: number | null;
  retentionPurgeDays: number | null;
  requireArchiveReason: boolean;
  allowOrgOutcomeFallback: boolean;
}>;

@Injectable()
export class PoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  private getDefaultPolicy(): Omit<EffectiveOperationalPolicy, 'id' | 'organizationId' | 'campaignId' | 'sourceScope' | 'explicitRecord' | 'inheritedFromOrganization'> {
    const archiveDays = Number(process.env.RETENTION_ARCHIVE_DAYS ?? '');
    const purgeDays = Number(process.env.RETENTION_PURGE_DAYS ?? '');

    return {
      defaultImportMode: (process.env.DEFAULT_IMPORT_MODE === 'upsert' ? 'upsert' : 'create_only'),
      defaultDuplicateStrategy: this.normalizeDuplicateStrategy(process.env.DEFAULT_IMPORT_DUPLICATE_STRATEGY),
      sensitiveMfaWindowMinutes: this.normalizePositiveInteger(getSensitiveMfaWindowMinutes(), 5, 'sensitiveMfaWindowMinutes'),
      retentionArchiveDays: Number.isFinite(archiveDays) && archiveDays > 0 ? archiveDays : null,
      retentionPurgeDays: Number.isFinite(purgeDays) && purgeDays > 0 ? purgeDays : null,
      requireArchiveReason: process.env.REQUIRE_ARCHIVE_REASON === 'true',
      allowOrgOutcomeFallback: process.env.ALLOW_ORG_OUTCOME_FALLBACK !== 'false'
    };
  }

  private normalizeDuplicateStrategy(value: unknown): DuplicateStrategy {
    return value === 'error' || value === 'merge' ? value : 'skip';
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
      defaultImportMode: (record.defaultImportMode === 'upsert' ? 'upsert' : 'create_only') as ImportMode,
      defaultDuplicateStrategy: this.normalizeDuplicateStrategy(record.defaultDuplicateStrategy),
      sensitiveMfaWindowMinutes: this.normalizePositiveInteger(record.sensitiveMfaWindowMinutes, 5, 'sensitiveMfaWindowMinutes'),
      retentionArchiveDays: record.retentionArchiveDays ?? null,
      retentionPurgeDays: record.retentionPurgeDays ?? null,
      requireArchiveReason: record.requireArchiveReason,
      allowOrgOutcomeFallback: record.allowOrgOutcomeFallback
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
      defaultImportMode: input.defaultImportMode ?? current.defaultImportMode,
      defaultDuplicateStrategy: input.defaultDuplicateStrategy ?? current.defaultDuplicateStrategy,
      sensitiveMfaWindowMinutes:
        input.sensitiveMfaWindowMinutes === undefined
          ? current.sensitiveMfaWindowMinutes
          : this.normalizePositiveInteger(input.sensitiveMfaWindowMinutes, current.sensitiveMfaWindowMinutes, 'sensitiveMfaWindowMinutes'),
      retentionArchiveDays: normalizedArchiveDays === undefined ? current.retentionArchiveDays : normalizedArchiveDays,
      retentionPurgeDays: normalizedPurgeDays === undefined ? current.retentionPurgeDays : normalizedPurgeDays,
      requireArchiveReason: input.requireArchiveReason ?? current.requireArchiveReason,
      allowOrgOutcomeFallback: input.allowOrgOutcomeFallback ?? current.allowOrgOutcomeFallback
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
}
