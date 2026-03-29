import { UnauthorizedException } from '@nestjs/common';
import { MfaChallengePurpose, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import * as mfaUtil from './mfa.util';
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
    mfaSecret: null,
    mfaTempSecret: null,
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
    mfaChallengeToken: {
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
    prisma.mfaChallengeToken.create.mockResolvedValue({ id: 'challenge-1' });
    prisma.mfaChallengeToken.update.mockResolvedValue({ id: 'challenge-1' });
    prisma.mfaChallengeToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        passwordResetToken: { update: jest.fn().mockResolvedValue({ id: 'reset-1' }) },
        authRefreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        activationToken: { update: jest.fn().mockResolvedValue({ id: 'activation-1' }) },
        mfaChallengeToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }
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
  });

  it('logs in successfully and rotates refresh state for a non-admin active user', async () => {
    const user = buildUser();
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login('morgan@example.com', 'Password123!');

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'signed-access-token',
        refreshToken: expect.any(String),
        token: 'signed-access-token',
        role: user.role,
        user
      })
    );
    expect(prisma.authRefreshToken.create).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'login_succeeded',
        entityId: user.id
      })
    );
  });

  it('returns an MFA setup challenge for admin users without MFA enabled', async () => {
    const user = buildUser({ role: UserRole.admin });
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login(user.email, 'Password123!');

    expect(prisma.mfaChallengeToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        purpose: MfaChallengePurpose.setup,
        usedAt: null
      },
      data: {
        usedAt: expect.any(Date)
      }
    });
    expect(prisma.mfaChallengeToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        purpose: MfaChallengePurpose.setup
      })
    });
    expect(result).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        setupRequired: true,
        challengeToken: expect.any(String)
      })
    );
    expect(prisma.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it('returns an MFA verification challenge for admin users with MFA enabled', async () => {
    const user = buildUser({ role: UserRole.admin, mfaEnabled: true, mfaSecret: 'JBSWY3DPEHPK3PXP' });
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login(user.email, 'Password123!');

    expect(prisma.mfaChallengeToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        purpose: MfaChallengePurpose.verify
      })
    });
    expect(result).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        setupRequired: false,
        challengeToken: expect.any(String)
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

    expect(result.accessToken).toBe('signed-access-token');
    expect(prisma.authRefreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-1' },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it('returns success on logout when the refresh token was already gone', async () => {
    prisma.authRefreshToken.findFirst.mockResolvedValue(null);

    await expect(service.logout('missing-token')).resolves.toEqual({ success: true });
  });

  it('requests a password reset for a known user and records the audit event', async () => {
    const user = buildUser();
    usersService.findByEmail.mockResolvedValue(user);

    const result = await service.requestPasswordReset(user.email);

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

    expect(result.accessToken).toBe('signed-access-token');
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

    expect(result.user).toBe(invitedUser);
    expect(result.activationToken).toEqual(expect.any(String));
  });

  it('initializes MFA setup with a persisted temporary secret', async () => {
    const user = buildUser({ role: UserRole.admin });
    prisma.mfaChallengeToken.findFirst.mockResolvedValue({
      id: 'challenge-1',
      userId: user.id,
      user
    });

    const result = await service.initializeMfaSetup('challenge-token');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        mfaTempSecret: expect.any(String)
      }
    });
    expect(result.otpauthUri).toContain('otpauth://totp/');
  });

  it('completes MFA setup and issues a session after a valid code', async () => {
    const user = buildUser({
      role: UserRole.admin,
      mfaTempSecret: 'JBSWY3DPEHPK3PXP'
    });
    prisma.mfaChallengeToken.findFirst.mockResolvedValue({
      id: 'challenge-1',
      userId: user.id,
      user
    });
    usersService.findById.mockResolvedValue({
      ...user,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP',
      mfaTempSecret: null
    });
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(true);

    const result = await service.completeMfaSetup('challenge-token', '123456');

    expect(result.accessToken).toBe('signed-access-token');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        mfaTempSecret: null,
        mfaEnabled: true
      }
    });
    verifySpy.mockRestore();
  });

  it('verifies a valid MFA challenge and then issues a session', async () => {
    const user = buildUser({
      role: UserRole.admin,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });
    prisma.mfaChallengeToken.findFirst.mockResolvedValue({
      id: 'challenge-2',
      userId: user.id,
      user
    });
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(true);

    const result = await service.verifyMfaChallenge('challenge-token', '123456');

    expect(result.accessToken).toBe('signed-access-token');
    expect(prisma.mfaChallengeToken.update).toHaveBeenCalledWith({
      where: { id: 'challenge-2' },
      data: { usedAt: expect.any(Date) }
    });
    verifySpy.mockRestore();
  });

  it('disables MFA only after validating password and the current TOTP code', async () => {
    const user = buildUser({
      role: UserRole.admin,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(true);

    const result = await service.disableMfa(user.id, 'Password123!', '123456');

    expect(result).toEqual({
      success: true,
      setupRequiredOnNextLogin: true
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'mfa_disabled',
        entityId: user.id
      })
    );
    verifySpy.mockRestore();
  });
});
