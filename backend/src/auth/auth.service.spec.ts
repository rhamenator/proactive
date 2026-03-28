import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  default: {
    hash: jest.fn(async () => 'placeholder-password-hash'),
    compare: jest.fn()
  }
}));

function buildInvitedUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    firstName: 'Morgan',
    lastName: 'Supervisor',
    email: 'morgan@example.com',
    role: UserRole.supervisor,
    isActive: false,
    status: 'invited',
    mfaEnabled: false,
    invitedAt: new Date('2026-03-28T00:00:00.000Z'),
    activatedAt: null,
    lastLoginAt: null,
    createdAt: new Date('2026-03-28T00:00:00.000Z'),
    ...overrides
  };
}

describe('AuthService', () => {
  const usersService = {
    sanitize: jest.fn((value) => value),
    createInvitedCanvasser: jest.fn()
  };
  const prisma = {
    activationToken: {
      updateMany: jest.fn(),
      create: jest.fn()
    },
    authRefreshToken: {
      create: jest.fn()
    }
  };
  const jwtService = {
    signAsync: jest.fn()
  };
  const auditService = {
    log: jest.fn()
  };

  const service = new AuthService(usersService as never, prisma as never, jwtService as never, auditService as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.activationToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.activationToken.create.mockResolvedValue({ id: 'activation-1' });
    auditService.log.mockResolvedValue(undefined);
  });

  it('invites a supervisor and records a field-user audit event', async () => {
    const invitedUser = buildInvitedUser();
    usersService.createInvitedCanvasser.mockResolvedValue(invitedUser);

    const result = await service.inviteCanvasser({
      firstName: 'Morgan',
      lastName: 'Supervisor',
      email: 'morgan@example.com',
      role: UserRole.supervisor
    });

    expect(usersService.createInvitedCanvasser).toHaveBeenCalledWith({
      firstName: 'Morgan',
      lastName: 'Supervisor',
      email: 'morgan@example.com',
      role: UserRole.supervisor,
      passwordHash: 'placeholder-password-hash'
    });
    expect(prisma.activationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: invitedUser.id,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date)
      })
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'field_user_invited',
        entityType: 'user',
        entityId: invitedUser.id,
        newValuesJson: {
          role: UserRole.supervisor
        }
      })
    );
    expect(result.user).toBe(invitedUser);
    expect(result.activationToken).toEqual(expect.any(String));
  });
});
