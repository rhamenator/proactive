import { UnauthorizedException } from '@nestjs/common';
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

const mockedBcrypt = jest.mocked(bcrypt);

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    firstName: 'Morgan',
    lastName: 'Supervisor',
    email: 'morgan@example.com',
    passwordHash: 'stored-password-hash',
    role: UserRole.supervisor,
    isActive: true,
    status: 'active',
    mfaEnabled: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    invitedAt: new Date('2026-03-28T00:00:00.000Z'),
    activatedAt: new Date('2026-03-28T01:00:00.000Z'),
    lastLoginAt: null,
    createdAt: new Date('2026-03-28T00:00:00.000Z'),
    ...overrides
  };
}

describe('AuthService', () => {
  const usersService = {
    sanitize: jest.fn((value) => value),
    createInvitedCanvasser: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn()
  };
  const prisma = {
    activationToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    },
    authRefreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    passwordResetToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn()
    },
    user: {
      update: jest.fn()
    },
    $transaction: jest.fn()
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
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'reset-1' });
    prisma.authRefreshToken.create.mockResolvedValue({ id: 'refresh-1' });
    prisma.authRefreshToken.update.mockResolvedValue({ id: 'refresh-1' });
    prisma.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        passwordResetToken: { update: jest.fn().mockResolvedValue({ id: 'reset-1' }) },
        authRefreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        activationToken: { update: jest.fn().mockResolvedValue({ id: 'activation-1' }) }
      })
    );
    jwtService.signAsync.mockResolvedValue('signed-access-token');
    auditService.log.mockResolvedValue(undefined);
  });

  it('rejects invalid credentials when the user is missing or inactive', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(service.validateUser('missing@example.com', 'Password123!')).rejects.toBeInstanceOf(
      UnauthorizedException
    );

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'login_failed',
        entityId: 'missing@example.com',
        reasonCode: 'INVALID_CREDENTIALS'
      })
    );
  });

  it('locks the account after the configured number of failed password attempts', async () => {
    usersService.findByEmail.mockResolvedValue(buildUser({ failedLoginAttempts: 4 }));
    mockedBcrypt.compare.mockResolvedValue(false as never);

    await expect(service.validateUser('morgan@example.com', 'bad-password')).rejects.toBeInstanceOf(
      UnauthorizedException
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        failedLoginAttempts: 5,
        status: 'locked',
        lockedUntil: expect.any(Date)
      })
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'login_failed',
        reasonCode: 'ACCOUNT_LOCKED'
      })
    );
  });

  it('logs in successfully and rotates refresh state for an active user', async () => {
    const user = buildUser();
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login('morgan@example.com', 'Password123!');

    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: user.id,
      email: user.email,
      role: user.role
    });
    expect(prisma.authRefreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date)
      })
    });
    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'login_succeeded',
        entityId: user.id
      })
    );
  });

  it('refreshes a valid session and revokes the previous refresh token', async () => {
    const user = buildUser();
    prisma.authRefreshToken.findFirst.mockResolvedValue({
      id: 'refresh-1',
      userId: user.id,
      user
    });

    const result = await service.refresh('opaque-refresh-token');

    expect(prisma.authRefreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
      data: { revokedAt: expect.any(Date) }
    });
    expect(prisma.authRefreshToken.create).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed-access-token');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'token_refreshed',
        entityId: user.id
      })
    );
  });

  it('returns success on logout when the refresh token was already gone', async () => {
    prisma.authRefreshToken.findFirst.mockResolvedValue(null);

    await expect(service.logout('missing-token')).resolves.toEqual({ success: true });
    expect(prisma.authRefreshToken.update).not.toHaveBeenCalled();
  });

  it('requests a password reset for a known user and records the audit event', async () => {
    const user = buildUser();
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.requestPasswordReset(user.email);

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: expect.any(Date)
      }
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date)
      })
    });
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        resetToken: expect.any(String),
        expiresAt: expect.any(Date)
      })
    );
  });

  it('activates a valid account token and issues a session', async () => {
    const user = buildUser();
    prisma.activationToken.findFirst.mockResolvedValue({
      id: 'activation-1',
      userId: user.id,
      user
    });
    usersService.findById.mockResolvedValue(user);

    const result = await service.activateAccount('activation-token', 'Password123!');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.accessToken).toBe('signed-access-token');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'account_activated',
        entityId: user.id
      })
    );
  });

  it('invites a supervisor and records a field-user audit event', async () => {
    const invitedUser = buildUser({
      isActive: false,
      status: 'invited',
      activatedAt: null
    });
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
