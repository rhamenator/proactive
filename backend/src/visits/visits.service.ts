import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, GpsStatus, Prisma, SyncStatus, UserRole, VisitResult, VisitSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccessScope } from '../common/interfaces/access-scope.interface';
import { PrismaService } from '../prisma/prisma.service';
import { getDistanceInMeters } from '../common/utils/distance.util';

@Injectable()
export class VisitsService {
  private readonly canvasserCorrectionWindowMinutes = Number(process.env.CANVASSER_CORRECTION_WINDOW_MINUTES ?? 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private normalizeLegacyResult(outcomeCode: string) {
    const normalized = outcomeCode.trim();
    const allowed = new Set<string>(Object.values(VisitResult));
    return allowed.has(normalized) ? (normalized as VisitResult) : VisitResult.other;
  }

  private getCorrectionWindowMinutes() {
    const parsed = Number.isFinite(this.canvasserCorrectionWindowMinutes)
      ? this.canvasserCorrectionWindowMinutes
      : Number.NaN;

    return parsed > 0 ? parsed : 10;
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
    return {
      organizationId: scope.organizationId,
      ...(scope.campaignId ? { campaignId: scope.campaignId } : {})
    } as const;
  }

  private async findScopedOutcomeDefinition(input: {
    organizationId: string | null;
    campaignId?: string | null;
    code: string;
  }) {
    const where: Prisma.OutcomeDefinitionWhereInput = {
      organizationId: input.organizationId,
      code: input.code,
      isActive: true,
      ...(input.campaignId
        ? {
            OR: [{ campaignId: input.campaignId }, { campaignId: null }]
          }
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
    const outcomes = await this.prisma.outcomeDefinition.findMany({
      where: {
        isActive: true,
        organizationId: scope.organizationId,
        ...(scope.campaignId
          ? {
              OR: [{ campaignId: scope.campaignId }, { campaignId: null }]
            }
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

      const ageMs = Date.now() - visit.visitTime.getTime();
      if (ageMs > this.getCorrectionWindowMinutes() * 60 * 1000) {
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
    if (input.localRecordUuid) {
      const existing = await this.prisma.visitLog.findUnique({
        where: { localRecordUuid: input.localRecordUuid }
      });
      if (existing) {
        return existing;
      }
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.visitLog.findUnique({
        where: { idempotencyKey: input.idempotencyKey }
      });
      if (existing) {
        return existing;
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

    const assignment = await this.prisma.turfAssignment.findFirst({
      where: {
        canvasserId: input.canvasserId,
        turfId: address.turfId,
        status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
      }
    });
    if (!assignment) {
      throw new BadRequestException('Canvasser is not assigned to this turf');
    }

    if (input.sessionId) {
      const session = await this.prisma.turfSession.findFirst({
        where: {
          id: input.sessionId,
          canvasserId: input.canvasserId,
          turfId: address.turfId
        }
      });

      if (!session) {
        throw new BadRequestException('Visit session is invalid for this turf');
      }
    }

    const visitSession =
      input.sessionId ??
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

    const maxAttemptsPerHousehold = Number(process.env.MAX_ATTEMPTS_PER_HOUSEHOLD ?? 3);
    const minMinutesBetweenAttempts = Number(process.env.MIN_MINUTES_BETWEEN_ATTEMPTS ?? 5);
    const attemptsForAddress = await this.prisma.visitLog.count({
      where: {
        turfId: address.turfId,
        addressId: address.id,
        deletedAt: null
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
        deletedAt: null
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

    const radiusFeet = process.env.GEOFENCE_RADIUS_FEET
      ? Number(process.env.GEOFENCE_RADIUS_FEET)
      : process.env.GEOFENCE_RADIUS_METERS
        ? Number(process.env.GEOFENCE_RADIUS_METERS) * 3.28084
        : 75;
    const radiusMeters = radiusFeet * 0.3048;
    const accuracyThresholdMeters = Number(process.env.GPS_LOW_ACCURACY_METERS ?? 30);
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

    return this.prisma.$transaction(async (tx) => {
      const visit = await tx.visitLog.create({
        data: {
          turfId: address.turfId,
          addressId: address.id,
          sessionId: visitSession,
          canvasserId: input.canvasserId,
          organizationId: address.organizationId ?? address.turf.organizationId,
          campaignId: address.campaignId ?? address.turf.campaignId,
          outcomeDefinitionId: outcomeDefinition.id,
          result: this.normalizeLegacyResult(outcomeDefinition.code),
          outcomeCode: outcomeDefinition.code,
          outcomeLabel: outcomeDefinition.label,
          contactMade: outcomeDefinition.code === 'talked_to_voter',
          notes: input.notes,
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
