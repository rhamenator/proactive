import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const safeUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  isActive: true,
  status: true,
  mfaEnabled: true,
  invitedAt: true,
  activatedAt: true,
  lastLoginAt: true,
  createdAt: true
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardSummary() {
    const [users, turfs, addresses, assignments, activeSessions, visits] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.turf.count(),
      this.prisma.address.count(),
      this.prisma.turfAssignment.count(),
      this.prisma.turfSession.count({ where: { endTime: null } }),
      this.prisma.visitLog.count()
    ]);

    const completedAddresses = await this.prisma.visitLog.findMany({
      distinct: ['addressId'],
      select: { addressId: true }
    });

    const activeCanvassers = await this.prisma.turfSession.findMany({
      where: { endTime: null },
      include: {
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { startTime: 'desc' }
    });

    const perTurf = await this.prisma.turf.findMany({
      include: {
        addresses: true,
        assignments: true,
        sessions: {
          where: { endTime: null }
        },
        visits: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      totals: {
        users,
        admins: await this.prisma.user.count({ where: { role: UserRole.admin } }),
        supervisors: await this.prisma.user.count({ where: { role: UserRole.supervisor } }),
        canvassers: await this.prisma.user.count({ where: { role: UserRole.canvasser } }),
        turfs,
        addresses,
        assignments,
        activeSessions,
        visits,
        completedAddresses: completedAddresses.length
      },
      activeCanvassers,
      turfs: perTurf.map((turf) => ({
        id: turf.id,
        name: turf.name,
        description: turf.description,
        addressCount: turf.addresses.length,
        assignmentCount: turf.assignments.length,
        activeSessionCount: turf.sessions.length,
        visitCount: turf.visits.length,
        progressPercent: turf.addresses.length
          ? Math.round((new Set(turf.visits.map((visit) => visit.addressId)).size / turf.addresses.length) * 100)
          : 0
      }))
    };
  }

  async activeCanvassers() {
    return this.prisma.turfSession.findMany({
      where: { endTime: null },
      orderBy: { startTime: 'desc' },
      include: {
        canvasser: {
          select: safeUserSelect
        },
        turf: {
          include: {
            addresses: true,
            visits: true
          }
        }
      }
    });
  }

  async listCanvassers() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      select: safeUserSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
  }
}
