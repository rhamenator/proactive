import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GeographyNodeKind, Prisma, UserRole } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AccessScope } from '../common/interfaces/access-scope.interface.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type GeographyNodeInput = {
  externalId: string;
  kind: GeographyNodeKind;
  name: string;
  parentId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  metadataJson?: Prisma.InputJsonValue | null;
};

@Injectable()
export class GeographiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private requireOrganization(scope: AccessScope) {
    if (!scope.organizationId) {
      throw new BadRequestException('Geography management requires an organization-scoped account');
    }
    return scope.organizationId;
  }

  private async assertVisible(scope: AccessScope, nodeId: string) {
    const organizationId = this.requireOrganization(scope);
    const node = await this.prisma.geographyNode.findFirst({ where: { id: nodeId, organizationId } });
    if (!node) throw new NotFoundException('Geography node not found');

    if (scope.role === UserRole.supervisor) {
      if (!scope.geographyNodeId) {
        throw new ForbiddenException('Supervisor has no configured geography scope');
      }
      const visible = await this.prisma.geographyClosure.findUnique({
        where: { ancestorId_descendantId: { ancestorId: scope.geographyNodeId, descendantId: nodeId } }
      });
      if (!visible) throw new ForbiddenException('Geography node is outside your assigned scope');
    }
    return node;
  }

  async list(scope: AccessScope, input: { parentId?: string | null; kind?: GeographyNodeKind; includeInactive?: boolean } = {}) {
    const organizationId = this.requireOrganization(scope);
    if (input.parentId) await this.assertVisible(scope, input.parentId);

    const where: Prisma.GeographyNodeWhereInput = {
      organizationId,
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(!input.includeInactive ? { isActive: true } : {})
    };
    if (scope.role === UserRole.supervisor) {
      if (!scope.geographyNodeId) return [];
      where.descendantLinks = { some: { ancestorId: scope.geographyNodeId } };
    }

    return this.prisma.geographyNode.findMany({
      where,
      orderBy: [{ depth: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, externalId: true, name: true, kind: true } },
        _count: { select: { children: true, users: true, turfs: true } }
      }
    });
  }

  async create(scope: AccessScope, input: GeographyNodeInput, actorUserId: string) {
    const organizationId = this.requireOrganization(scope);
    const externalId = input.externalId.trim();
    const name = input.name.trim();
    if (!externalId || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(externalId)) {
      throw new BadRequestException('externalId must be a stable 1-100 character identifier');
    }
    if (!name) throw new BadRequestException('Geography name is required');

    const parent = input.parentId
      ? await this.prisma.geographyNode.findFirst({ where: { id: input.parentId, organizationId } })
      : null;
    if (input.parentId && !parent) throw new BadRequestException('Parent is outside the organization');

    const created = await this.prisma.$transaction(async (tx) => {
      const node = await tx.geographyNode.create({
        data: {
          organizationId,
          externalId,
          kind: input.kind,
          name,
          parentId: parent?.id ?? null,
          depth: parent ? parent.depth + 1 : 0,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
          ...(input.metadataJson !== undefined ? { metadataJson: input.metadataJson ?? Prisma.JsonNull } : {})
        }
      });
      const ancestorLinks = parent
        ? await tx.geographyClosure.findMany({ where: { descendantId: parent.id } })
        : [];
      await tx.geographyClosure.createMany({
        data: [
          ...ancestorLinks.map((link) => ({ ancestorId: link.ancestorId, descendantId: node.id, depth: link.depth + 1 })),
          { ancestorId: node.id, descendantId: node.id, depth: 0 }
        ]
      });
      return node;
    });

    await this.audit.log({
      actorUserId,
      actionType: 'geography_node_created',
      entityType: 'geography_node',
      entityId: created.id,
      newValuesJson: created as unknown as Prisma.InputJsonValue
    });
    return created;
  }

  async update(
    scope: AccessScope,
    nodeId: string,
    input: Partial<Omit<GeographyNodeInput, 'externalId'>>,
    actorUserId: string,
    reason?: string
  ) {
    const organizationId = this.requireOrganization(scope);
    const existing = await this.assertVisible(scope, nodeId);
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException('Geography name is required');
    if (input.parentId === nodeId) throw new BadRequestException('A geography node cannot be its own parent');

    let parent = null;
    if (input.parentId) {
      parent = await this.prisma.geographyNode.findFirst({ where: { id: input.parentId, organizationId } });
      if (!parent) throw new BadRequestException('Parent is outside the organization');
      const cycle = await this.prisma.geographyClosure.findUnique({
        where: { ancestorId_descendantId: { ancestorId: nodeId, descendantId: parent.id } }
      });
      if (cycle) throw new BadRequestException('A geography node cannot be moved beneath its descendant');
    }

    const parentChanged = input.parentId !== undefined && input.parentId !== existing.parentId;
    const updated = await this.prisma.$transaction(async (tx) => {
      if (parentChanged) {
        const subtree = await tx.geographyClosure.findMany({ where: { ancestorId: nodeId } });
        const subtreeIds = subtree.map((link) => link.descendantId);
        await tx.geographyClosure.deleteMany({
          where: { descendantId: { in: subtreeIds }, ancestorId: { notIn: subtreeIds } }
        });
        const newAncestors = parent
          ? await tx.geographyClosure.findMany({ where: { descendantId: parent.id } })
          : [];
        if (newAncestors.length > 0) {
          await tx.geographyClosure.createMany({
            data: newAncestors.flatMap((ancestor) =>
              subtree.map((descendant) => ({
                ancestorId: ancestor.ancestorId,
                descendantId: descendant.descendantId,
                depth: ancestor.depth + 1 + descendant.depth
              }))
            )
          });
        }
        const nextDepth = parent ? parent.depth + 1 : 0;
        const depthDelta = nextDepth - existing.depth;
        for (const descendant of subtree) {
          await tx.geographyNode.update({
            where: { id: descendant.descendantId },
            data: { depth: { increment: depthDelta } }
          });
        }
      }
      return tx.geographyNode.update({
        where: { id: nodeId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.metadataJson !== undefined ? { metadataJson: input.metadataJson ?? Prisma.JsonNull } : {})
        }
      });
    });

    await this.audit.log({
      actorUserId,
      actionType: parentChanged ? 'geography_node_moved' : 'geography_node_updated',
      entityType: 'geography_node',
      entityId: nodeId,
      reasonText: reason?.trim() || undefined,
      oldValuesJson: existing as unknown as Prisma.InputJsonValue,
      newValuesJson: updated as unknown as Prisma.InputJsonValue
    });
    return updated;
  }

  async assignUser(scope: AccessScope, nodeId: string, userId: string, actorUserId: string, reason: string) {
    const organizationId = this.requireOrganization(scope);
    await this.assertVisible(scope, nodeId);
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found in this organization');
    const reasonText = reason.trim();
    if (!reasonText) throw new BadRequestException('Assignment reason is required');
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { geographyNodeId: nodeId } });
    await this.audit.log({
      actorUserId,
      actionType: 'user_geography_assigned',
      entityType: 'user',
      entityId: userId,
      reasonText,
      oldValuesJson: { geographyNodeId: user.geographyNodeId ?? null },
      newValuesJson: { geographyNodeId: nodeId }
    });
    return updated;
  }

  async reportingFilter(scope: AccessScope, nodeId: string) {
    await this.assertVisible(scope, nodeId);
    const links = await this.prisma.geographyClosure.findMany({
      where: { ancestorId: nodeId },
      select: { descendantId: true, depth: true },
      orderBy: { depth: 'asc' }
    });
    const geographyNodeIds = links.map((link) => link.descendantId);
    const [turfs, users] = await Promise.all([
      this.prisma.turf.findMany({ where: { geographyNodeId: { in: geographyNodeIds } }, select: { id: true } }),
      this.prisma.user.findMany({ where: { geographyNodeId: { in: geographyNodeIds }, deletedAt: null }, select: { id: true } })
    ]);
    return { nodeId, geographyNodeIds, turfIds: turfs.map(({ id }) => id), userIds: users.map(({ id }) => id) };
  }
}
