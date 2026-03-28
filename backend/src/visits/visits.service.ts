import { BadRequestException, Injectable } from '@nestjs/common';
import { AssignmentStatus, GpsStatus, SyncStatus, VisitResult, VisitSource } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { getDistanceInMeters } from '../common/utils/distance.util';

@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private normalizeLegacyResult(outcomeCode: string) {
    const normalized = outcomeCode.trim();
    const allowed = new Set<string>(Object.values(VisitResult));
    return allowed.has(normalized) ? (normalized as VisitResult) : VisitResult.other;
  }

  async listActiveOutcomes() {
    return this.prisma.outcomeDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { label: 'asc' }]
    });
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

    if (!address) {
      throw new BadRequestException('Address not found');
    }

    const outcomeDefinition = await this.prisma.outcomeDefinition.findFirst({
      where: {
        code: input.outcomeCode,
        isActive: true
      }
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
        addressId: address.id
      }
    });

    if (attemptsForAddress >= maxAttemptsPerHousehold) {
      throw new BadRequestException('This household has reached the maximum attempts for this turf cycle');
    }

    const previousVisitByCanvasser = await this.prisma.visitLog.findFirst({
      where: {
        turfId: address.turfId,
        addressId: address.id,
        canvasserId: input.canvasserId
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
          contactMade: input.contactMade ?? false,
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
