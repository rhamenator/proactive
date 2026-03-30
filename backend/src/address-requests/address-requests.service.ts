import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AddressRequestStatus,
  AssignmentStatus,
  Prisma,
  SessionStatus,
  UserRole
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { buildNormalizedAddressKey } from '../common/utils/address-normalization.util';
import { PrismaService } from '../prisma/prisma.service';

type RequestViewer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};

type RequestTurf = {
  id: string;
  name: string;
};

type RequestAddress = {
  id: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
};

type RequestRecord = {
  id: string;
  status: AddressRequestStatus;
  addressLine1: string;
  city: string;
  state: string;
  zip: string | null;
  latitude: Prisma.Decimal | null;
  longitude: Prisma.Decimal | null;
  notes: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewReason: string | null;
  organizationId: string | null;
  campaignId: string | null;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  approvedAddressId: string | null;
  turf: RequestTurf;
  requestedByUser: RequestViewer;
  reviewedByUser: RequestViewer | null;
  approvedAddress: RequestAddress | null;
};

type SerializedAddressRequest = {
  id: string;
  status: AddressRequestStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewReason: string | null;
  notes: string | null;
  organizationId: string | null;
  campaignId: string | null;
  requestedAddress: {
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  turf: RequestTurf;
  requestedBy: RequestViewer;
  reviewedBy: RequestViewer | null;
  approvedAddress: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

@Injectable()
export class AddressRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  private readonly requestInclude = {
    turf: {
      select: { id: true, name: true }
    },
    requestedByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    },
    reviewedByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      }
    },
    approvedAddress: {
      select: {
        id: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
        latitude: true,
        longitude: true
      }
    }
  } satisfies Prisma.AddressRequestInclude;

  private ensureFieldRole(role: UserRole) {
    if (role !== UserRole.canvasser && role !== UserRole.supervisor) {
      throw new ForbiddenException('Only field users can submit address requests');
    }
  }

  private ensureReviewerRole(role: UserRole) {
    if (role !== UserRole.admin && role !== UserRole.supervisor) {
      throw new ForbiddenException('Only admins and supervisors can review address requests');
    }
  }

  private normalizeAddress(input: {
    addressLine1: string;
    city: string;
    state: string;
    zip?: string;
  }) {
    return {
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      zip: input.zip?.trim() || null
    };
  }

  private toNumber(value: Prisma.Decimal | null) {
    if (value === null) {
      return null;
    }

    return Number(value);
  }

  private serializeRequest(record: RequestRecord): SerializedAddressRequest {
    return {
      id: record.id,
      status: record.status,
      submittedAt: record.submittedAt,
      reviewedAt: record.reviewedAt,
      reviewReason: record.reviewReason,
      notes: record.notes,
      organizationId: record.organizationId,
      campaignId: record.campaignId,
      requestedAddress: {
        addressLine1: record.addressLine1,
        city: record.city,
        state: record.state,
        zip: record.zip,
        latitude: this.toNumber(record.latitude),
        longitude: this.toNumber(record.longitude)
      },
      turf: record.turf,
      requestedBy: record.requestedByUser,
      reviewedBy: record.reviewedByUser,
      approvedAddress: record.approvedAddress
        ? {
            id: record.approvedAddress.id,
            addressLine1: record.approvedAddress.addressLine1,
            city: record.approvedAddress.city,
            state: record.approvedAddress.state,
            zip: record.approvedAddress.zip,
            latitude: this.toNumber(record.approvedAddress.latitude),
            longitude: this.toNumber(record.approvedAddress.longitude)
          }
        : null
    };
  }

  private async findScopedTurf(turfId: string, organizationId: string | null) {
    const turf = await this.prisma.turf.findFirst({
      where: {
        id: turfId,
        organizationId
      }
    });

    if (!turf) {
      throw new NotFoundException('Turf not found');
    }

    return turf;
  }

  private async ensureFieldAccess(input: {
    turfId: string;
    actorUserId: string;
    organizationId: string | null;
  }) {
    const [assignment, activeSession] = await Promise.all([
      this.prisma.turfAssignment.findFirst({
        where: {
          turfId: input.turfId,
          organizationId: input.organizationId,
          canvasserId: input.actorUserId,
          status: { in: [AssignmentStatus.assigned, AssignmentStatus.active] }
        }
      }),
      this.prisma.turfSession.findFirst({
        where: {
          turfId: input.turfId,
          organizationId: input.organizationId,
          canvasserId: input.actorUserId,
          status: SessionStatus.active
        }
      })
    ]);

    if (!assignment && !activeSession) {
      throw new ForbiddenException('You can only request addresses for a turf you are assigned to or actively working');
    }
  }

  private buildDuplicateWhere(input: {
    organizationId: string | null;
    turfId: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
  }): Prisma.AddressWhereInput {
    return {
      organizationId: input.organizationId,
      turfId: input.turfId,
      deletedAt: null,
      normalizedAddressKey: buildNormalizedAddressKey(input)
    };
  }

  private findMatchingHousehold(input: {
    organizationId: string | null;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
  }) {
    if (!input.organizationId) {
      throw new BadRequestException('Address requests require an organization-scoped actor');
    }

    return this.prisma.household.findFirst({
      where: {
        organizationId: input.organizationId,
        normalizedAddressKey: buildNormalizedAddressKey(input),
        deletedAt: null
      }
    });
  }

  private async ensureHousehold(input: {
    organizationId: string | null;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
    latitude?: Prisma.Decimal | number | null;
    longitude?: Prisma.Decimal | number | null;
  }) {
    const existing = await this.findMatchingHousehold(input);
    if (existing) {
      if (
        (input.latitude !== null && input.latitude !== undefined && existing.latitude === null) ||
        (input.longitude !== null && input.longitude !== undefined && existing.longitude === null)
      ) {
        return this.prisma.household.update({
          where: { id: existing.id },
          data: {
            normalizedAddressKey: buildNormalizedAddressKey(input),
            latitude: input.latitude ?? existing.latitude,
            longitude: input.longitude ?? existing.longitude
          }
        });
      }

      return existing;
    }

    return this.prisma.household.create({
      data: {
        organizationId: input.organizationId!,
        addressLine1: input.addressLine1,
        city: input.city,
        state: input.state,
        zip: input.zip,
        normalizedAddressKey: buildNormalizedAddressKey(input),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        source: 'field_request',
        approvalStatus: 'approved'
      }
    });
  }

  private buildPendingDuplicateWhere(input: {
    turfId: string;
    addressLine1: string;
    city: string;
    state: string;
    zip: string | null;
  }): Prisma.AddressRequestWhereInput {
    return {
      turfId: input.turfId,
      status: AddressRequestStatus.pending,
      addressLine1: {
        equals: input.addressLine1,
        mode: 'insensitive'
      },
      city: {
        equals: input.city,
        mode: 'insensitive'
      },
      state: {
        equals: input.state,
        mode: 'insensitive'
      },
      zip: input.zip
    };
  }

  private async findScopedRequest(requestId: string, organizationId: string | null) {
    const request = await this.prisma.addressRequest.findFirst({
      where: {
        id: requestId,
        organizationId
      },
      include: this.requestInclude
    });

    if (!request) {
      throw new NotFoundException('Address request not found');
    }

    return request as RequestRecord;
  }

  async submitRequest(input: {
    actorUserId: string;
    actorRole: UserRole;
    organizationId: string | null;
    turfId: string;
    addressLine1: string;
    city: string;
    state: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
  }) {
    this.ensureFieldRole(input.actorRole);

    const turf = await this.findScopedTurf(input.turfId, input.organizationId);
    await this.ensureFieldAccess({
      turfId: input.turfId,
      actorUserId: input.actorUserId,
      organizationId: input.organizationId
    });

    const normalized = this.normalizeAddress(input);

    const [existingAddress, existingPendingRequest] = await Promise.all([
      this.prisma.address.findFirst({
        where: this.buildDuplicateWhere({
          organizationId: input.organizationId,
          turfId: input.turfId,
          ...normalized
        })
      }),
      this.prisma.addressRequest.findFirst({
        where: this.buildPendingDuplicateWhere({
          turfId: input.turfId,
          ...normalized
        })
      })
    ]);

    if (existingAddress) {
      throw new BadRequestException('This address already exists on the selected turf');
    }

    if (existingPendingRequest) {
      throw new BadRequestException('A pending request already exists for this address');
    }

    const request = (await this.prisma.addressRequest.create({
      data: {
        turfId: input.turfId,
        organizationId: input.organizationId,
        campaignId: turf.campaignId,
        requestedByUserId: input.actorUserId,
        addressLine1: normalized.addressLine1,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        latitude: input.latitude,
        longitude: input.longitude,
        notes: input.notes?.trim() || null
      },
      include: this.requestInclude
    })) as RequestRecord;

    await this.auditService.log({
      actorUserId: input.actorUserId,
      actionType: 'address_request_submitted',
      entityType: 'address_request',
      entityId: request.id,
      newValuesJson: {
        turfId: request.turf.id,
        turfName: request.turf.name,
        addressLine1: request.addressLine1,
        city: request.city,
        state: request.state,
        zip: request.zip
      }
    });

    return this.serializeRequest(request);
  }

  async listOwnRequests(input: {
    actorUserId: string;
    actorRole: UserRole;
    organizationId: string | null;
    take?: number;
  }) {
    this.ensureFieldRole(input.actorRole);

    const requests = (await this.prisma.addressRequest.findMany({
      where: {
        requestedByUserId: input.actorUserId,
        organizationId: input.organizationId
      },
      orderBy: [{ submittedAt: 'desc' }],
      take: input.take ?? 25,
      include: this.requestInclude
    })) as RequestRecord[];

    return requests.map((request) => this.serializeRequest(request));
  }

  async reviewQueue(input: {
    actorRole: UserRole;
    organizationId: string | null;
    status?: AddressRequestStatus;
    take?: number;
  }) {
    this.ensureReviewerRole(input.actorRole);

    const requests = (await this.prisma.addressRequest.findMany({
      where: {
        organizationId: input.organizationId,
        ...(input.status ? { status: input.status } : {})
      },
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      take: input.take ?? 50,
      include: this.requestInclude
    })) as RequestRecord[];

    return requests.map((request) => this.serializeRequest(request));
  }

  async approveRequest(input: {
    requestId: string;
    actorUserId: string;
    actorRole: UserRole;
    organizationId: string | null;
    reason?: string;
  }) {
    this.ensureReviewerRole(input.actorRole);

    const request = await this.findScopedRequest(input.requestId, input.organizationId);
    if (request.status !== AddressRequestStatus.pending) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const normalized = this.normalizeAddress({
      addressLine1: request.addressLine1,
      city: request.city,
      state: request.state,
      zip: request.zip ?? undefined
    });

    const existingAddress = await this.prisma.address.findFirst({
      where: this.buildDuplicateWhere({
        organizationId: request.organizationId,
        turfId: request.turf.id,
        ...normalized
      })
    });

    if (existingAddress) {
      throw new BadRequestException('This address already exists on the selected turf');
    }

    const approved = (await this.prisma.$transaction(async (tx) => {
      const household = await this.ensureHousehold({
        organizationId: request.organizationId,
        addressLine1: normalized.addressLine1,
        city: normalized.city,
        state: normalized.state,
        zip: normalized.zip,
        latitude: request.latitude,
        longitude: request.longitude
      });

      const approvedAddress = await tx.address.create({
        data: {
          turfId: request.turf.id,
          householdId: household.id,
          organizationId: request.organizationId,
          campaignId: request.campaignId,
          addressLine1: normalized.addressLine1,
          city: normalized.city,
          state: normalized.state,
          zip: normalized.zip,
          normalizedAddressKey: buildNormalizedAddressKey(normalized),
          latitude: request.latitude,
          longitude: request.longitude,
          addedInField: true
        }
      });

      return tx.addressRequest.update({
        where: { id: request.id },
        data: {
          status: AddressRequestStatus.approved,
          reviewedByUserId: input.actorUserId,
          reviewedAt: new Date(),
          reviewReason: input.reason?.trim() || null,
          approvedAddressId: approvedAddress.id
        },
        include: this.requestInclude
      });
    })) as RequestRecord;

    await this.auditService.log({
      actorUserId: input.actorUserId,
      actionType: 'address_request_approved',
      entityType: 'address_request',
      entityId: request.id,
      reasonText: input.reason?.trim() || undefined,
      newValuesJson: {
        approvedAddressId: approved.approvedAddressId,
        turfId: approved.turf.id
      }
    });

    return this.serializeRequest(approved);
  }

  async rejectRequest(input: {
    requestId: string;
    actorUserId: string;
    actorRole: UserRole;
    organizationId: string | null;
    reason?: string;
  }) {
    this.ensureReviewerRole(input.actorRole);

    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const request = await this.findScopedRequest(input.requestId, input.organizationId);
    if (request.status !== AddressRequestStatus.pending) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const rejected = (await this.prisma.addressRequest.update({
      where: { id: request.id },
      data: {
        status: AddressRequestStatus.rejected,
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        reviewReason: reason
      },
      include: this.requestInclude
    })) as RequestRecord;

    await this.auditService.log({
      actorUserId: input.actorUserId,
      actionType: 'address_request_rejected',
      entityType: 'address_request',
      entityId: request.id,
      reasonText: reason
    });

    return this.serializeRequest(rejected);
  }
}
