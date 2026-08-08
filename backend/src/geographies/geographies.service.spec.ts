import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { GeographyNodeKind, UserRole } from '../../generated/prisma/client.js';
import { GeographiesService } from './geographies.service.js';

describe('GeographiesService', () => {
  const prisma = {
    $transaction: jest.fn(),
    geographyNode: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    geographyClosure: { findUnique: jest.fn(), findMany: jest.fn(), createMany: jest.fn(), deleteMany: jest.fn() },
    user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    turf: { findMany: jest.fn() }
  };
  const audit = { log: jest.fn() };
  const service = new GeographiesService(prisma as never, audit as never);
  const adminScope = { organizationId: 'org-1', role: UserRole.admin };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  });

  it('creates a stable organization-scoped child and all ancestor closure links', async () => {
    prisma.geographyNode.findFirst.mockResolvedValue({ id: 'parent-1', organizationId: 'org-1', depth: 1 });
    prisma.geographyNode.create.mockResolvedValue({
      id: 'node-1', organizationId: 'org-1', externalId: 'PRECINCT-007', kind: GeographyNodeKind.precinct, name: 'Precinct 7', parentId: 'parent-1', depth: 2
    });
    prisma.geographyClosure.findMany.mockResolvedValue([
      { ancestorId: 'root-1', descendantId: 'parent-1', depth: 1 },
      { ancestorId: 'parent-1', descendantId: 'parent-1', depth: 0 }
    ]);

    await service.create(adminScope, {
      externalId: 'PRECINCT-007', kind: GeographyNodeKind.precinct, name: 'Precinct 7', parentId: 'parent-1'
    }, 'admin-1');

    expect(prisma.geographyClosure.createMany).toHaveBeenCalledWith({ data: [
      { ancestorId: 'root-1', descendantId: 'node-1', depth: 2 },
      { ancestorId: 'parent-1', descendantId: 'node-1', depth: 1 },
      { ancestorId: 'node-1', descendantId: 'node-1', depth: 0 }
    ] });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actionType: 'geography_node_created', entityId: 'node-1' }));
  });

  it('rejects unstable external identifiers', async () => {
    await expect(service.create(adminScope, {
      externalId: 'not allowed / value', kind: GeographyNodeKind.custom, name: 'Bad'
    }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents moving a node beneath any of its descendants', async () => {
    prisma.geographyNode.findFirst
      .mockResolvedValueOnce({ id: 'ward-1', organizationId: 'org-1', parentId: null, depth: 0 })
      .mockResolvedValueOnce({ id: 'precinct-1', organizationId: 'org-1', depth: 1 });
    prisma.geographyClosure.findUnique.mockResolvedValue({ ancestorId: 'ward-1', descendantId: 'precinct-1', depth: 1 });

    await expect(service.update(adminScope, 'ward-1', { parentId: 'precinct-1' }, 'admin-1'))
      .rejects.toThrow('cannot be moved beneath its descendant');
  });

  it.each([
    ['assigned root', 'root-1'],
    ['nested ward', 'ward-1'],
    ['leaf precinct', 'precinct-1']
  ])('authorizes supervisor reporting at the %s level through closure membership', async (_label, nodeId) => {
    prisma.geographyNode.findFirst.mockResolvedValue({ id: nodeId, organizationId: 'org-1' });
    prisma.geographyClosure.findUnique.mockResolvedValue({ ancestorId: 'root-1', descendantId: nodeId });
    prisma.geographyClosure.findMany.mockResolvedValue([{ descendantId: nodeId, depth: 0 }]);
    prisma.turf.findMany.mockResolvedValue([{ id: `turf-${nodeId}` }]);
    prisma.user.findMany.mockResolvedValue([{ id: `user-${nodeId}` }]);

    const result = await service.reportingFilter({
      organizationId: 'org-1', role: UserRole.supervisor, geographyNodeId: 'root-1'
    }, nodeId);

    expect(result.geographyNodeIds).toEqual([nodeId]);
  });

  it('denies a supervisor access to a sibling branch', async () => {
    prisma.geographyNode.findFirst.mockResolvedValue({ id: 'other-ward', organizationId: 'org-1' });
    prisma.geographyClosure.findUnique.mockResolvedValue(null);
    await expect(service.reportingFilter({
      organizationId: 'org-1', role: UserRole.supervisor, geographyNodeId: 'ward-1'
    }, 'other-ward')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires a reason and organization match when assigning a supervisor scope', async () => {
    prisma.geographyNode.findFirst.mockResolvedValue({ id: 'ward-1', organizationId: 'org-1' });
    prisma.user.findFirst.mockResolvedValue({ id: 'supervisor-1', organizationId: 'org-1', geographyNodeId: null });
    await expect(service.assignUser(adminScope, 'ward-1', 'supervisor-1', 'admin-1', '   '))
      .rejects.toThrow('Assignment reason is required');
  });
});
