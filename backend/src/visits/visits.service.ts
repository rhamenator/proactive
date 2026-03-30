import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, GpsStatus, Prisma, SyncStatus, UserRole, VisitResult, VisitSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PrismaService } from '../prisma/prisma.service';
import { getDistanceInMeters } from '../common/utils/distance.util';
import { PoliciesService } from '../policies/policies.service';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService
  ) {}

  private normalizeLegacyResult(outcomeCode: string) {
    const normalized = outcomeCode.trim();
    const allowed = new Set<string>(Object.values(VisitResult));
    return allowed.has(normalized) ? (normalized as VisitResult) : VisitResult.other;
  }

  private getCorrectionWindowMinutes(policy: { canvasserCorrectionWindowMinutes: number }) {
    return policy.canvasserCorrectionWindowMinutes > 0 ? policy.canvasserCorrectionWindowMinutes : 10;
  }

  private buildCorrectionLockReason(visit: {
    vanExported: boolean;
    syncConflictFlag: boolean;
    syncStatus: SyncStatus;
    geofenceResult: { overrideFlag: boolean } | null;
  }) {
    if (visit.vanExported) {
      return 'Exported visits are locked and cannot be corrected';
    }

    if (visit.syncConflictFlag || visit.syncStatus === SyncStatus.conflict) {
      return 'Resolve the sync conflict before correcting this visit';
    }

    if (visit.geofenceResult?.overrideFlag) {
      return 'Visits with GPS overrides are locked and cannot be corrected';
    }

    return null;
  }

  private normalizeCorrectionNotes(notes: string | undefined, existingNotes: string | null) {
    if (notes === undefined) {
      return existingNotes;
    }

    const trimmed = notes.trim();
    return trimmed ? trimmed : null;
  }

  private buildCorrectionSnapshot(visit: {
    outcomeDefinitionId: string | null;
    outcomeCode: string;
    outcomeLabel: string;
    result: VisitResult;
    notes: string | null;
    contactMade: boolean;
  }) {
    return {
      outcomeDefinitionId: visit.outcomeDefinitionId,
      outcomeCode: visit.outcomeCode,
      outcomeLabel: visit.outcomeLabel,
      result: visit.result,
      notes: visit.notes,
      contactMade: visit.contactMade
    };
  }

  private buildScopedWhere(scope: AccessScope) {
    const where = {
      organizationId: scope.organizationId
    } as Record<string, unknown>;

    if (scope.role === UserRole.supervisor) {
      if (scope.teamId) {
        where.teamId = scope.teamId;
      } else if (scope.regionCode) {
        where.regionCode = scope.regionCode;
      } else if (scope.campaignId) {
        where.campaignId = scope.campaignId;
      }
    } else if (scope.campaignId) {
      where.campaignId = scope.campaignId;
    }

    return where;
  }

  private normalizeOptionalText(value: string | undefined | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private buildConflictError(input: {
    message: string;
    reason: string;
    visitId?: string;
    localRecordUuid?: string;
    idempotencyKey?: string;
  }) {
    return new ConflictException({
      message: input.message,
      syncStatus: SyncStatus.conflict,
      syncConflictFlag: true,
      syncConflictReason: input.reason,
      visitId: input.visitId ?? null,
      localRecordUuid: input.localRecordUuid ?? null,
      idempotencyKey: input.idempotencyKey ?? null
    });
  }

  private visitMatchesIncomingSubmission(input: {
    existing: {
      canvasserId: string;
      turfId: string;
      addressId: string;
      sessionId: string | null;
      outcomeCode: string;
      notes: string | null;
      clientCreatedAt: Date | null;
    };
    next: {
      canvasserId: string;
      turfId: string;
      addressId: string;
      sessionId: string | null;
      outcomeCode: string;
      notes?: string;
      clientCreatedAt?: string;
    };
  }) {
    return (
      input.existing.canvasserId === input.next.canvasserId &&
      input.existing.turfId === input.next.turfId &&
      input.existing.addressId === input.next.addressId &&
      (input.existing.sessionId ?? null) === input.next.sessionId &&
      input.existing.outcomeCode === input.next.outcomeCode &&
      (input.existing.notes ?? null) === this.normalizeOptionalText(input.next.notes) &&
      (input.existing.clientCreatedAt?.toISOString() ?? null) ===
        (input.next.clientCreatedAt ? new Date(input.next.clientCreatedAt).toISOString() : null)
    );
  }

  private async markExistingVisitConflict(input: {
    existingVisitId: string;
    actorUserId: string;
    conflictReason: string;
    reasonMessage: string;
    localRecordUuid?: string;
    idempotencyKey?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.visitLog.update({
        where: { id: input.existingVisitId },
        data: {
          syncStatus: SyncStatus.conflict,
          syncConflictFlag: true,
          syncConflictReason: input.conflictReason
        }
      });

      await tx.syncEvent.create({
        data: {
          entityType: 'visit_log',
          entityId: updated.id,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          eventType: 'duplicate_payload_conflict',
          syncStatus: SyncStatus.conflict,
          attemptCount: 1,
          errorCode: input.conflictReason,
          errorMessage: input.reasonMessage,
          attemptedAt: new Date(),
          completedAt: new Date()
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.actorUserId,
          actionType: 'visit_sync_conflict_detected',
          entityType: 'visit_log',
          entityId: updated.id,
          reasonCode: input.conflictReason,
          reasonText: input.reasonMessage,
          newValuesJson: {
            syncStatus: updated.syncStatus,
            syncConflictFlag: updated.syncConflictFlag,
            syncConflictReason: updated.syncConflictReason,
            localRecordUuid: input.localRecordUuid ?? null,
            idempotencyKey: input.idempotencyKey ?? null
          }
        },
        tx
      );

      return updated;
    });
  }

  private async createConflictVisit(input: {
    address: Awaited<ReturnType<PrismaService['address']['findUnique']>> & { turf: { id: string; organizationId: string | null; campaignId: string | null; teamId?: string | null; regionCode?: string | null } };
    outcomeDefinition: { id: string; code: string; label: string };
    canvasserId: string;
    sessionId?: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    localRecordUuid?: string;
    idempotencyKey?: string;
    clientCreatedAt?: string;
    gpsStatus: GpsStatus;
    geofenceValidated: boolean;
    geofenceDistanceMeters?: number;
    distanceFromTargetFeet?: number;
    validationRadiusFeet: number;
    failureReason?: string;
    reason: string;
    reasonMessage: string;
  }) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.create({
        data: {
          turfId: input.address.turfId,
          addressId: input.address.id,
          sessionId: input.sessionId,
          canvasserId: input.canvasserId,
          organizationId: input.address.organizationId ?? input.address.turf.organizationId,
          campaignId: input.address.campaignId ?? input.address.turf.campaignId,
          teamId: input.address.teamId ?? input.address.turf.teamId ?? null,
          regionCode: input.address.regionCode ?? input.address.turf.regionCode ?? null,
          outcomeDefinitionId: input.outcomeDefinition.id,
          result: this.normalizeLegacyResult(input.outcomeDefinition.code),
          outcomeCode: input.outcomeDefinition.code,
          outcomeLabel: input.outcomeDefinition.label,
          contactMade: input.outcomeDefinition.code === 'talked_to_voter',
          notes: input.notes,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          gpsStatus: input.gpsStatus,
          geofenceValidated: input.geofenceValidated,
          geofenceDistanceMeters: input.geofenceDistanceMeters ? Math.round(input.geofenceDistanceMeters) : undefined,
          syncStatus: SyncStatus.conflict,
          syncConflictFlag: true,
          syncConflictReason: input.reason,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined,
          serverReceivedAt: now,
          source: VisitSource.mobile_app
        }
      });

      await tx.visitGeofenceResult.create({
        data: {
          visitLogId: visit.id,
          addressId: input.address.id,
          targetLatitude: input.address.latitude,
          targetLongitude: input.address.longitude,
          capturedLatitude: input.latitude,
          capturedLongitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          distanceFromTargetFeet: input.distanceFromTargetFeet,
          validationRadiusFeet: input.validationRadiusFeet,
          gpsStatus: input.gpsStatus,
          failureReason: input.failureReason ?? input.reason,
          capturedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : now
        }
      });

      await tx.syncEvent.create({
        data: {
          entityType: 'visit_log',
          entityId: visit.id,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          eventType: 'ingest_conflict',
          syncStatus: SyncStatus.conflict,
          attemptCount: 1,
          errorCode: input.reason,
          errorMessage: input.reasonMessage,
          attemptedAt: now,
          completedAt: now
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'visit_sync_conflict_detected',
          entityType: 'visit_log',
          entityId: visit.id,
          reasonCode: input.reason,
          reasonText: input.reasonMessage,
          newValuesJson: {
            addressId: input.address.id,
            turfId: input.address.turfId,
            localRecordUuid: input.localRecordUuid ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            syncStatus: SyncStatus.conflict,
            syncConflictReason: input.reason
          }
        },
        tx
      );

      return visit;
    });
  }

  private async findScopedOutcomeDefinition(input: {
    organizationId: string | null;
    campaignId?: string | null;
    code: string;
  }) {
    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: input.organizationId,
      campaignId: input.campaignId ?? null
    });
    const where: Prisma.OutcomeDefinitionWhereInput = {
      organizationId: input.organizationId,
      code: input.code,
      isActive: true,
      ...(input.campaignId
        ? policy.allowOrgOutcomeFallback
          ? {
              OR: [{ campaignId: input.campaignId }, { campaignId: null }]
            }
          : { campaignId: input.campaignId }
        : { campaignId: null })
    };

    return this.prisma.outcomeDefinition.findFirst({
      where,
      orderBy: [
        { campaignId: 'desc' },
        { displayOrder: 'asc' },
        { label: 'asc' }
      ]
    });
  }

  async listActiveOutcomes(scope: AccessScope) {
    const policy = await this.policiesService.getEffectivePolicy(scope);
    const outcomes = await this.prisma.outcomeDefinition.findMany({
      where: {
        isActive: true,
        organizationId: scope.organizationId,
        ...(scope.campaignId
          ? policy.allowOrgOutcomeFallback
            ? {
                OR: [{ campaignId: scope.campaignId }, { campaignId: null }]
              }
            : { campaignId: scope.campaignId }
          : { campaignId: null })
      },
      orderBy: [{ campaignId: 'desc' }, { displayOrder: 'asc' }, { label: 'asc' }]
    });

    const deduped = new Map<string, (typeof outcomes)[number]>();
    for (const outcome of outcomes) {
      if (!deduped.has(outcome.code)) {
        deduped.set(outcome.code, outcome);
      }
    }

    return Array.from(deduped.values()).sort(
      (left, right) => left.displayOrder - right.displayOrder || left.label.localeCompare(right.label)
    );
  }

  async listRecentVisits(input: {
    requesterId: string;
    requesterRole: UserRole;
    scope: AccessScope;
    turfId?: string;
    canvasserId?: string;
    addressId?: string;
  }) {
    const canvasserId =
      input.requesterRole === UserRole.canvasser
        ? input.requesterId
        : input.canvasserId;

    return this.prisma.visitLog.findMany({
      where: {
        ...this.buildScopedWhere(input.scope),
        deletedAt: null,
        ...(input.turfId ? { turfId: input.turfId } : {}),
        ...(canvasserId ? { canvasserId } : {}),
        ...(input.addressId ? { addressId: input.addressId } : {})
      },
      orderBy: { visitTime: 'desc' },
      take: 100,
      include: {
        address: true,
        turf: {
          select: { id: true, name: true }
        },
        canvasser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            organizationId: true,
            campaignId: true,
            teamId: true,
            regionCode: true,
            isActive: true,
            status: true,
            mfaEnabled: true,
            invitedAt: true,
            activatedAt: true,
            lastLoginAt: true,
            createdAt: true
          }
        },
        geofenceResult: true
      }
    });
  }

  async correctVisit(input: {
    visitId: string;
    actorUserId: string;
    actorRole: UserRole;
    scope: AccessScope;
    outcomeCode: string;
    notes?: string;
    reason: string;
  }) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Correction reason is required');
    }

    const visit = await this.prisma.visitLog.findFirst({
      where: {
        id: input.visitId,
        ...this.buildScopedWhere(input.scope),
        deletedAt: null
      },
      include: {
        geofenceResult: true
      }
    });

    if (!visit) {
      throw new NotFoundException('Visit not found');
    }

    if (input.actorRole === UserRole.canvasser) {
      if (visit.canvasserId !== input.actorUserId) {
        throw new ForbiddenException('You can only correct your own recent submissions');
      }

      const correctionPolicy = await this.policiesService.getEffectivePolicy({
        organizationId: visit.organizationId,
        campaignId: visit.campaignId
      });
      const ageMs = Date.now() - visit.visitTime.getTime();
      if (ageMs > this.getCorrectionWindowMinutes(correctionPolicy) * 60 * 1000) {
        throw new ForbiddenException('The correction window for this visit has expired');
      }
    }

    const lockReason = this.buildCorrectionLockReason(visit);
    if (lockReason) {
      throw new BadRequestException(lockReason);
    }

    const outcomeDefinition = await this.findScopedOutcomeDefinition({
      organizationId: input.scope.organizationId,
      campaignId: input.scope.campaignId ?? null,
      code: input.outcomeCode
    });

    if (!outcomeDefinition) {
      throw new BadRequestException('Visit outcome is not recognized');
    }

    const normalizedNotes = this.normalizeCorrectionNotes(input.notes, visit.notes);
    if (outcomeDefinition.requiresNote && !normalizedNotes) {
      throw new BadRequestException('Notes are required for the selected visit outcome');
    }

    const oldValues = this.buildCorrectionSnapshot(visit);
    const newValues = {
      outcomeDefinitionId: outcomeDefinition.id,
      outcomeCode: outcomeDefinition.code,
      outcomeLabel: outcomeDefinition.label,
      result: this.normalizeLegacyResult(outcomeDefinition.code),
      notes: normalizedNotes,
      contactMade: outcomeDefinition.code === 'talked_to_voter'
    };

    if (JSON.stringify(oldValues) === JSON.stringify(newValues)) {
      throw new BadRequestException('This correction does not change the visit');
    }

    const correctedVisit = await this.prisma.$transaction(async (tx) => {
      const updatedVisit = await tx.visitLog.update({
        where: { id: input.visitId },
        data: newValues
      });

      await tx.visitCorrection.create({
        data: {
          visitLogId: input.visitId,
          actorUserId: input.actorUserId,
          organizationId: visit.organizationId,
          campaignId: visit.campaignId,
          reasonText: reason,
          oldValuesJson: oldValues,
          newValuesJson: newValues
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.actorUserId,
          actionType: 'visit_corrected',
          entityType: 'visit_log',
          entityId: input.visitId,
          reasonText: reason,
          oldValuesJson: oldValues,
          newValuesJson: newValues
        },
        tx
      );

      return updatedVisit;
    });

    return correctedVisit;
  }

  async logVisit(input: {
    canvasserId: string;
    addressId: string;
    sessionId?: string;
    outcomeCode: string;
    contactMade?: boolean;
    notes?: string;
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number;
    localRecordUuid?: string;
    idempotencyKey?: string;
    clientCreatedAt?: string;
  }) {
    const existingByLocalRecordUuid = input.localRecordUuid
      ? await this.prisma.visitLog.findUnique({
          where: { localRecordUuid: input.localRecordUuid }
        })
      : null;
    const existingByIdempotencyKey = input.idempotencyKey
      ? await this.prisma.visitLog.findUnique({
          where: { idempotencyKey: input.idempotencyKey }
        })
      : null;

    if (input.localRecordUuid) {
      const existing = existingByLocalRecordUuid;
      if (existing) {
        if (existing.syncStatus === SyncStatus.conflict || existing.syncConflictFlag) {
          throw this.buildConflictError({
            message: existing.syncConflictReason ?? 'This visit requires admin review before it can sync',
            reason: existing.syncConflictReason ?? 'existing_conflict',
            visitId: existing.id,
            localRecordUuid: existing.localRecordUuid ?? input.localRecordUuid,
            idempotencyKey: existing.idempotencyKey ?? input.idempotencyKey
          });
        }
      }
    }

    if (input.idempotencyKey) {
      const existing = existingByIdempotencyKey;
      if (existing) {
        if (existing.syncStatus === SyncStatus.conflict || existing.syncConflictFlag) {
          throw this.buildConflictError({
            message: existing.syncConflictReason ?? 'This visit requires admin review before it can sync',
            reason: existing.syncConflictReason ?? 'existing_conflict',
            visitId: existing.id,
            localRecordUuid: existing.localRecordUuid ?? input.localRecordUuid,
            idempotencyKey: existing.idempotencyKey ?? input.idempotencyKey
          });
        }
      }
    }

    const address = await this.prisma.address.findUnique({
      where: { id: input.addressId },
      include: { turf: true }
    });

    if (!address || address.deletedAt) {
      throw new BadRequestException('Address not found');
    }

    const outcomeDefinition = await this.findScopedOutcomeDefinition({
      organizationId: address.organizationId,
      campaignId: address.campaignId ?? address.turf.campaignId ?? null,
      code: input.outcomeCode
    });

    if (!outcomeDefinition) {
      throw new BadRequestException('Visit outcome is not recognized');
    }

    if (outcomeDefinition.requiresNote && !input.notes?.trim()) {
      throw new BadRequestException('Notes are required for the selected visit outcome');
    }

    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: address.organizationId ?? address.turf.organizationId,
      campaignId: address.campaignId ?? address.turf.campaignId ?? null
    });
    const maxAttemptsPerHousehold = policy.maxAttemptsPerHousehold;
    const minMinutesBetweenAttempts = policy.minMinutesBetweenAttempts;
    const attemptsForAddress = await this.prisma.visitLog.count({
      where: {
        turfId: address.turfId,
        addressId: address.id,
        deletedAt: null,
        syncStatus: { not: SyncStatus.conflict }
      }
    });

    if (attemptsForAddress >= maxAttemptsPerHousehold) {
      throw new BadRequestException('This household has reached the maximum attempts for this turf cycle');
    }

    const previousVisitByCanvasser = await this.prisma.visitLog.findFirst({
      where: {
        turfId: address.turfId,
        addressId: address.id,
        canvasserId: input.canvasserId,
        deletedAt: null,
        syncStatus: { not: SyncStatus.conflict }
      },
      orderBy: { visitTime: 'desc' }
    });

    if (previousVisitByCanvasser) {
      const elapsedMs = Date.now() - previousVisitByCanvasser.visitTime.getTime();
      const minElapsedMs = minMinutesBetweenAttempts * 60 * 1000;
      if (elapsedMs < minElapsedMs) {
        throw new BadRequestException(
          `Please wait ${minMinutesBetweenAttempts} minutes before logging another attempt for this household`
        );
      }
    }

    const radiusFeet = policy.geofenceRadiusFeet;
    const radiusMeters = radiusFeet * 0.3048;
    const accuracyThresholdMeters = policy.gpsLowAccuracyMeters;
    let geofenceValidated = true;
    let geofenceDistanceMeters: number | undefined;
    let distanceFromTargetFeet: number | undefined;
    let gpsStatus: GpsStatus = GpsStatus.missing;
    let failureReason: string | undefined;

    const hasCapturedLocation =
      input.latitude !== undefined && input.longitude !== undefined;
    const hasTargetLocation =
      address.latitude !== null && address.longitude !== null;

    if (!hasCapturedLocation) {
      gpsStatus = GpsStatus.missing;
      failureReason = 'gps_missing';
    } else if (input.accuracyMeters !== undefined && input.accuracyMeters > accuracyThresholdMeters) {
      gpsStatus = GpsStatus.low_accuracy;
      failureReason = 'low_accuracy';
    } else if (!hasTargetLocation) {
      gpsStatus = GpsStatus.missing;
      failureReason = 'target_missing';
    } else {
      geofenceDistanceMeters = getDistanceInMeters(
        input.latitude!,
        input.longitude!,
        Number(address.latitude),
        Number(address.longitude)
      );
      distanceFromTargetFeet = geofenceDistanceMeters * 3.28084;
      geofenceValidated = geofenceDistanceMeters <= radiusMeters;
      gpsStatus = geofenceValidated ? GpsStatus.verified : GpsStatus.flagged;
      failureReason = geofenceValidated ? undefined : 'outside_radius';
    }

    if (gpsStatus !== GpsStatus.verified) {
      geofenceValidated = false;
    }

    const assignment = await this.prisma.turfAssignment.findFirst({
      where: {
        canvasserId: input.canvasserId,
        turfId: address.turfId,
        status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
      }
    });
    if (!assignment) {
      const conflictVisit = await this.createConflictVisit({
        address,
        outcomeDefinition,
        canvasserId: input.canvasserId,
        sessionId: input.sessionId,
        notes: input.notes,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyMeters: input.accuracyMeters,
        localRecordUuid: input.localRecordUuid,
        idempotencyKey: input.idempotencyKey,
        clientCreatedAt: input.clientCreatedAt,
        gpsStatus,
        geofenceValidated,
        geofenceDistanceMeters,
        distanceFromTargetFeet,
        validationRadiusFeet: radiusFeet,
        failureReason,
        reason: 'assignment_changed',
        reasonMessage: 'The turf assignment changed before this offline visit could sync'
      });
      throw this.buildConflictError({
        message: 'The turf assignment changed before this offline visit could sync',
        reason: 'assignment_changed',
        visitId: conflictVisit.id,
        localRecordUuid: input.localRecordUuid,
        idempotencyKey: input.idempotencyKey
      });
    }

    let validatedSessionId: string | undefined;
    if (input.sessionId) {
      const session = await this.prisma.turfSession.findFirst({
        where: {
          id: input.sessionId,
          canvasserId: input.canvasserId,
          turfId: address.turfId
        }
      });

      if (!session) {
        const conflictVisit = await this.createConflictVisit({
          address,
          outcomeDefinition,
          canvasserId: input.canvasserId,
          sessionId: input.sessionId,
          notes: input.notes,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          clientCreatedAt: input.clientCreatedAt,
          gpsStatus,
          geofenceValidated,
          geofenceDistanceMeters,
          distanceFromTargetFeet,
          validationRadiusFeet: radiusFeet,
          failureReason,
          reason: 'session_invalid',
          reasonMessage: 'The recorded turf session is no longer valid for this visit'
        });
        throw this.buildConflictError({
          message: 'The recorded turf session is no longer valid for this visit',
          reason: 'session_invalid',
          visitId: conflictVisit.id,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey
        });
      }

      validatedSessionId = session.id;
    }

    const visitSession =
      validatedSessionId ??
      (
        await this.prisma.turfSession.findFirst({
          where: {
            canvasserId: input.canvasserId,
            turfId: address.turfId,
            endTime: null
          },
          orderBy: { startTime: 'desc' }
        })
      )?.id;

    const duplicateVisit = existingByLocalRecordUuid ?? existingByIdempotencyKey;
    if (duplicateVisit) {
      const isSameSubmission = this.visitMatchesIncomingSubmission({
        existing: duplicateVisit,
        next: {
          canvasserId: input.canvasserId,
          turfId: address.turfId,
          addressId: address.id,
          sessionId: visitSession ?? null,
          outcomeCode: outcomeDefinition.code,
          notes: input.notes,
          clientCreatedAt: input.clientCreatedAt
        }
      });

      if (isSameSubmission) {
        return duplicateVisit;
      }

      const conflictReason = existingByLocalRecordUuid
        ? 'local_record_uuid_payload_mismatch'
        : 'idempotency_key_payload_mismatch';
      const reasonMessage =
        'This queued visit does not match the previously synced submission with the same local identifier.';

      await this.markExistingVisitConflict({
        existingVisitId: duplicateVisit.id,
        actorUserId: input.canvasserId,
        conflictReason,
        reasonMessage,
        localRecordUuid: input.localRecordUuid,
        idempotencyKey: input.idempotencyKey
      });

      throw this.buildConflictError({
        message: reasonMessage,
        reason: conflictReason,
        visitId: duplicateVisit.id,
        localRecordUuid: input.localRecordUuid,
        idempotencyKey: input.idempotencyKey
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.create({
        data: {
          turfId: address.turfId,
          addressId: address.id,
          sessionId: visitSession,
          canvasserId: input.canvasserId,
          organizationId: address.organizationId ?? address.turf.organizationId,
          campaignId: address.campaignId ?? address.turf.campaignId,
          teamId: address.teamId ?? address.turf.teamId,
          regionCode: address.regionCode ?? address.turf.regionCode,
          outcomeDefinitionId: outcomeDefinition.id,
          result: this.normalizeLegacyResult(outcomeDefinition.code),
          outcomeCode: outcomeDefinition.code,
          outcomeLabel: outcomeDefinition.label,
          contactMade: outcomeDefinition.code === 'talked_to_voter',
          notes: this.normalizeOptionalText(input.notes),
          latitude: input.latitude,
          longitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          gpsStatus,
          geofenceValidated,
          geofenceDistanceMeters: geofenceDistanceMeters
            ? Math.round(geofenceDistanceMeters)
            : undefined,
          syncStatus: SyncStatus.synced,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          clientCreatedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : undefined,
          serverReceivedAt: new Date(),
          source: VisitSource.mobile_app
        }
      });

      await tx.visitGeofenceResult.create({
        data: {
          visitLogId: visit.id,
          addressId: address.id,
          targetLatitude: address.latitude,
          targetLongitude: address.longitude,
          capturedLatitude: input.latitude,
          capturedLongitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          distanceFromTargetFeet,
          validationRadiusFeet: radiusFeet,
          gpsStatus,
          failureReason,
          capturedAt: input.clientCreatedAt ? new Date(input.clientCreatedAt) : new Date()
        }
      });

      await tx.syncEvent.create({
        data: {
          entityType: 'visit_log',
          entityId: visit.id,
          localRecordUuid: input.localRecordUuid,
          idempotencyKey: input.idempotencyKey,
          eventType: 'ingest',
          syncStatus: SyncStatus.synced,
          attemptCount: 1,
          attemptedAt: new Date(),
          completedAt: new Date()
        }
      });

      await this.auditService.log(
        {
          actorUserId: input.canvasserId,
          actionType: 'visit_created',
          entityType: 'visit_log',
          entityId: visit.id,
          newValuesJson: {
            addressId: address.id,
            turfId: address.turfId,
            result: visit.result,
            outcomeCode: visit.outcomeCode,
            outcomeLabel: visit.outcomeLabel,
            gpsStatus: visit.gpsStatus,
            syncStatus: visit.syncStatus,
            localRecordUuid: visit.localRecordUuid,
            idempotencyKey: visit.idempotencyKey
          }
        },
        tx
      );

      return visit;
    });
  }
}
