import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'hashed-password')
  }
}));

const mockedBcrypt = jest.mocked(bcrypt);

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    firstName: 'Taylor',
    lastName: 'Field',
    email: 'taylor@example.com',
    role: UserRole.canvasser,
    isActive: true,
    status: 'active',
    mfaEnabled: false,
    invitedAt: null,
    activatedAt: new Date('2026-03-28T00:00:00.000Z'),
    lastLoginAt: null,
    createdAt: new Date('2026-03-28T00:00:00.000Z'),
    ...overrides
  };
}

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const service = new UsersService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes optional user fields to stable defaults', () => {
    const result = service.sanitize(
      buildUser({
        status: null,
        mfaEnabled: null,
        invitedAt: undefined,
        activatedAt: undefined,
        lastLoginAt: undefined
      })
    );

    expect(result.status).toBe('active');
    expect(result.mfaEnabled).toBe(false);
    expect(result.invitedAt).toBeNull();
    expect(result.activatedAt).toBeNull();
    expect(result.lastLoginAt).toBeNull();
  });

  it('normalizes email when looking up a user by email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await service.findByEmail(' Taylor@Example.com ');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'taylor@example.com' }
    });
  });

  it('throws when a user lookup by id does not find a record', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.findById('missing-user')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('defaults created field users to the canvasser role and normalizes email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => buildUser(data));

    const result = await service.createCanvasser({
      firstName: 'Taylor',
      lastName: 'Field',
      email: 'Taylor@Example.com ',
      password: 'Password123!'
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'taylor@example.com',
        passwordHash: 'hashed-password',
        role: UserRole.canvasser
      })
    });
    expect(mockedBcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
    expect(result.role).toBe(UserRole.canvasser);
  });

  it('allows supervisors through the field-user creation path', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => buildUser(data));

    const result = await service.createCanvasser({
      firstName: 'Casey',
      lastName: 'Lead',
      email: 'casey@example.com',
      password: 'Password123!',
      role: UserRole.supervisor
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: UserRole.supervisor
      })
    });
    expect(result.role).toBe(UserRole.supervisor);
  });

  it('rejects admin as a field-user role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createCanvasser({
        firstName: 'Avery',
        lastName: 'Admin',
        email: 'avery@example.com',
        password: 'Password123!',
        role: UserRole.admin
      })
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('lists supervisors and canvassers together', async () => {
    prisma.user.findMany.mockResolvedValue([
      buildUser({ id: 'user-1', role: UserRole.supervisor }),
      buildUser({ id: 'user-2', role: UserRole.canvasser })
    ]);

    const result = await service.listCanvassers();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: {
          in: [UserRole.supervisor, UserRole.canvasser]
        }
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
    expect(result).toHaveLength(2);
    expect(result.map((user) => user.role)).toEqual([UserRole.supervisor, UserRole.canvasser]);
  });

  it('rejects duplicate emails before creating a new field user', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await expect(
      service.createCanvasser({
        firstName: 'Jordan',
        lastName: 'Field',
        email: 'jordan@example.com',
        password: 'Password123!'
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('updates a canvasser with normalized email, active status, role, and hashed password', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUser({ id: 'user-2' }));
    prisma.user.update.mockImplementation(async ({ data }) => buildUser({ id: 'user-2', ...data }));

    const result = await service.updateCanvasser('user-2', {
      firstName: 'Jordan',
      lastName: 'Lane',
      email: ' Jordan@Example.com ',
      password: 'NewPassword123!',
      isActive: false,
      role: UserRole.supervisor
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-2' },
      data: expect.objectContaining({
        firstName: 'Jordan',
        lastName: 'Lane',
        email: 'jordan@example.com',
        isActive: false,
        status: 'inactive',
        role: UserRole.supervisor,
        passwordHash: 'hashed-password'
      })
    });
    expect(result.role).toBe(UserRole.supervisor);
    expect(result.status).toBe('inactive');
  });

  it('rejects updates for missing canvassers', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.updateCanvasser('missing-user', {
        firstName: 'Jamie'
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('creates invited canvassers with normalized email and invited status', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => buildUser(data));

    const result = await service.createInvitedCanvasser({
      firstName: 'Riley',
      lastName: 'Stone',
      email: ' Riley@Example.com ',
      passwordHash: 'invite-hash',
      role: UserRole.supervisor
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'riley@example.com',
        passwordHash: 'invite-hash',
        role: UserRole.supervisor,
        isActive: false,
        status: 'invited'
      })
    });
    expect(result.status).toBe('invited');
    expect(result.isActive).toBe(false);
  });

  it('rejects duplicate invited canvassers', async () => {
    prisma.user.findUnique.mockResolvedValue(buildUser());

    await expect(
      service.createInvitedCanvasser({
        firstName: 'Riley',
        lastName: 'Stone',
        email: 'riley@example.com',
        passwordHash: 'invite-hash'
      })
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
