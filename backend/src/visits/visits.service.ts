import { BadRequestException, Injectable } from '@nestjs/common';
import { AssignmentStatus, VisitResult } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getDistanceInMeters } from '../common/utils/distance.util';

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async logVisit(input: {
    canvasserId: string;
    addressId: string;
    result: VisitResult;
    contactMade?: boolean;
    notes?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const address = await this.prisma.address.findUnique({
      where: { id: input.addressId },
      include: { turf: true }
    });

    if (!address) {
      throw new BadRequestException('Address not found');
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

    const radiusMeters = Number(process.env.GEOFENCE_RADIUS_METERS ?? 100);
    let geofenceValidated = true;
    let geofenceDistanceMeters: number | undefined;

    if (
      input.latitude !== undefined &&
      input.longitude !== undefined &&
      address.latitude !== null &&
      address.longitude !== null
    ) {
      geofenceDistanceMeters = Math.round(
        getDistanceInMeters(
          input.latitude,
          input.longitude,
          Number(address.latitude),
          Number(address.longitude)
        )
      );
      geofenceValidated = geofenceDistanceMeters <= radiusMeters;
    }

    return this.prisma.visitLog.create({
      data: {
        turfId: address.turfId,
        addressId: address.id,
        canvasserId: input.canvasserId,
        result: input.result,
        contactMade: input.contactMade ?? false,
        notes: input.notes,
        latitude: input.latitude,
        longitude: input.longitude,
        geofenceValidated,
        geofenceDistanceMeters
      }
    });
  }
}
