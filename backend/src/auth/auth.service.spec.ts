import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
    lastName: 'Canvasser',
    email: 'morgan@example.com',
    passwordHash: 'stored-password-hash',
    role: UserRole.canvasser,
    organizationId: null,
    campaignId: null,
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
    mfaBackupCode: {
      count: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn()
    },
    impersonationSession: {
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
  const policiesService = {
    getEffectivePolicy: jest.fn().mockResolvedValue({
      sensitiveMfaWindowMinutes: 5,
      refreshTokenTtlDays: 14,
      activationTokenTtlHours: 48,
      passwordResetTtlMinutes: 30,
      loginLockoutThreshold: 5,
      loginLockoutMinutes: 15,
      mfaChallengeTtlMinutes: 10,
      mfaBackupCodeCount: 10
    })
  };
  const systemSettingsService = {
    getEffectiveSettings: jest.fn().mockResolvedValue({
      authRateLimitWindowMinutes: 15,
      authRateLimitMaxAttempts: 10,
      retentionJobEnabled: false,
      retentionJobIntervalMinutes: 60
    })
  };

  const service = new AuthService(
    usersService as never,
    prisma as never,
    jwtService as never,
    auditService as never,
    policiesService as never,
    systemSettingsService as never
  );

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
    prisma.mfaBackupCode.count.mockResolvedValue(10);
    prisma.mfaBackupCode.createMany.mockResolvedValue({ count: 10 });
    prisma.mfaBackupCode.deleteMany.mockResolvedValue({ count: 0 });
    prisma.mfaBackupCode.findFirst.mockResolvedValue(null);
    prisma.mfaBackupCode.update.mockResolvedValue({ id: 'backup-1' });
    prisma.impersonationSession.create.mockResolvedValue({ id: 'imp-1' });
    prisma.impersonationSession.findFirst.mockResolvedValue(null);
    prisma.impersonationSession.update.mockResolvedValue({ id: 'imp-1' });
    prisma.impersonationSession.updateMany.mockResolvedValue({ count: 0 });
    prisma.user.update.mockResolvedValue({ id: 'user-1' });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        user: { update: jest.fn().mockResolvedValue({ id: 'user-1' }) },
        passwordResetToken: { update: jest.fn().mockResolvedValue({ id: 'reset-1' }) },
        authRefreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        activationToken: { update: jest.fn().mockResolvedValue({ id: 'activation-1' }) },
        mfaChallengeToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        mfaBackupCode: {
          createMany: jest.fn().mockResolvedValue({ count: 10 }),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 })
        }
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

  it('logs in successfully and rotates refresh state for a canvasser active user', async () => {
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
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        lastLoginAt: expect.any(Date)
      }
    });
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
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.authRefreshToken.create).not.toHaveBeenCalled();
  });

  it('returns an MFA setup challenge for supervisor users without MFA enabled', async () => {
    const user = buildUser({ role: UserRole.supervisor });
    usersService.findByEmail.mockResolvedValue(user);
    usersService.findById.mockResolvedValue(user);
    mockedBcrypt.compare.mockResolvedValue(true as never);

    const result = await service.login(user.email, 'Password123!');

    expect(result).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        setupRequired: true,
        challengeToken: expect.any(String),
        role: UserRole.supervisor
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
        expiresAt: expect.any(Date)
      })
    );
    expect(result).not.toHaveProperty('resetToken');
  });

  it('uses policy-configured password reset expiry when issuing a reset token', async () => {
    const user = buildUser();
    usersService.findByEmail.mockResolvedValue(user);
    policiesService.getEffectivePolicy.mockResolvedValueOnce({
      sensitiveMfaWindowMinutes: 5,
      refreshTokenTtlDays: 14,
      activationTokenTtlHours: 48,
      passwordResetTtlMinutes: 45,
      loginLockoutThreshold: 5,
      loginLockoutMinutes: 15,
      mfaChallengeTtlMinutes: 10,
      mfaBackupCodeCount: 10
    });

    const result = await service.requestPasswordReset(user.email);

    if (!('expiresAt' in result)) {
      throw new Error('Expected a password reset response with expiresAt');
    }

    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        expiresAt: expect.any(Date)
      })
    });
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now() + 44 * 60 * 1000);
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

    expect('accessToken' in result ? result.accessToken : null).toBe('signed-access-token');
  });

  it('requires MFA enrollment after activating an admin account', async () => {
    const user = buildUser({
      role: UserRole.admin,
      mfaEnabled: false,
      activatedAt: null
    });
    prisma.activationToken.findFirst.mockResolvedValue({
      id: 'activation-1',
      userId: user.id,
      user
    });
    usersService.findById.mockResolvedValue({
      ...user,
      activatedAt: new Date('2026-03-28T01:00:00.000Z')
    });

    const result = await service.activateAccount('activation-token', 'Password123!');

    expect(result).toEqual(
      expect.objectContaining({
        mfaRequired: true,
        setupRequired: true,
        challengeToken: expect.any(String),
        role: UserRole.admin
      })
    );
    expect(prisma.authRefreshToken.create).not.toHaveBeenCalled();
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
      role: UserRole.supervisor,
      actorUserId: 'admin-1'
    });

    expect(result.user).toBe(invitedUser);
    expect(result.activationToken).toEqual(expect.any(String));
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        actionType: 'field_user_invited',
        entityId: invitedUser.id
      })
    );
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
    expect(result.backupCodes).toHaveLength(10);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        mfaSecret: 'JBSWY3DPEHPK3PXP',
        mfaTempSecret: null,
        mfaEnabled: true
      }
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        lastLoginAt: expect.any(Date)
      }
    });
    verifySpy.mockRestore();
  });

  it('uses the policy backup-code count when MFA setup completes', async () => {
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
    policiesService.getEffectivePolicy
      .mockResolvedValueOnce({
        sensitiveMfaWindowMinutes: 5,
        refreshTokenTtlDays: 14,
        activationTokenTtlHours: 48,
        passwordResetTtlMinutes: 30,
        loginLockoutThreshold: 5,
        loginLockoutMinutes: 15,
        mfaChallengeTtlMinutes: 10,
        mfaBackupCodeCount: 12
      })
      .mockResolvedValueOnce({
        sensitiveMfaWindowMinutes: 5,
        refreshTokenTtlDays: 14,
        activationTokenTtlHours: 48,
        passwordResetTtlMinutes: 30,
        loginLockoutThreshold: 5,
        loginLockoutMinutes: 15,
        mfaChallengeTtlMinutes: 10,
        mfaBackupCodeCount: 12
      });
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(true);

    const result = await service.completeMfaSetup('challenge-token', '123456');

    expect(result.backupCodes).toHaveLength(12);
    verifySpy.mockRestore();
  });

  it('accepts a valid backup code during MFA verification', async () => {
    const user = buildUser({
      role: UserRole.supervisor,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });
    prisma.mfaChallengeToken.findFirst.mockResolvedValue({
      id: 'challenge-2',
      userId: user.id,
      user
    });
    prisma.mfaBackupCode.findFirst.mockResolvedValue({
      id: 'backup-1',
      userId: user.id,
      codeHash: 'hash',
      usedAt: null,
      createdAt: new Date('2026-03-28T00:00:00.000Z')
    });
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(false);

    const result = await service.verifyMfaChallenge('challenge-token', 'ABCD-EF12');

    expect(result.accessToken).toBe('signed-access-token');
    expect(prisma.mfaBackupCode.update).toHaveBeenCalledWith({
      where: { id: 'backup-1' },
      data: { usedAt: expect.any(Date) }
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'mfa_backup_code_used',
        entityId: user.id
      })
    );
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
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: {
        lastLoginAt: expect.any(Date)
      }
    });
    verifySpy.mockRestore();
  });

  it('issues a fresh access token after a valid MFA step-up verification', async () => {
    const user = buildUser({
      role: UserRole.admin,
      mfaEnabled: true,
      mfaSecret: 'JBSWY3DPEHPK3PXP'
    });
    usersService.findById.mockResolvedValue(user);
    const verifySpy = jest.spyOn(mfaUtil, 'verifyTotp').mockReturnValue(true);

    const result = await service.stepUpMfa({ sub: user.id }, '123456');

    expect(result.accessToken).toBe('signed-access-token');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        mfaVerifiedAt: expect.any(String)
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'mfa_step_up_verified',
        entityId: user.id
      })
    );
    verifySpy.mockRestore();
  });

  it('rejects MFA step-up during impersonation', async () => {
    await expect(
      service.stepUpMfa({ sub: 'user-1', impersonatorUserId: 'admin-1' }, '123456')
    ).rejects.toBeInstanceOf(ForbiddenException);
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

  it('returns backup code counts in MFA status for required roles', async () => {
    const user = buildUser({ role: UserRole.supervisor, mfaEnabled: true });
    usersService.findById.mockResolvedValue(user);

    const result = await service.mfaStatus(user.id);

    expect(result).toEqual({
      enabled: true,
      required: true,
      backupCodeCount: 10
    });
  });

  it('starts an impersonation session for an admin targeting a field user in the same organization', async () => {
    const actor = buildUser({ id: 'admin-1', role: UserRole.admin, organizationId: 'org-1' });
    const target = buildUser({ id: 'user-2', role: UserRole.supervisor, organizationId: 'org-1' });
    usersService.findById
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(target);
    prisma.impersonationSession.create.mockResolvedValue({
      id: 'imp-1',
      startedAt: new Date('2026-03-29T21:00:00.000Z'),
      reasonText: 'Support',
      targetUser: target
    });

    const result = await service.startImpersonation(actor.id, target.id, 'Support');

    expect(prisma.impersonationSession.updateMany).toHaveBeenCalledWith({
      where: { actorUserId: actor.id, endedAt: null },
      data: { endedAt: expect.any(Date) }
    });
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'signed-access-token',
        token: 'signed-access-token',
        role: UserRole.supervisor,
        user: expect.objectContaining({
          id: target.id,
          email: target.email,
          role: UserRole.supervisor,
          impersonation: expect.objectContaining({
            sessionId: 'imp-1',
            actorUserId: actor.id,
            actorRole: UserRole.admin,
            reasonText: 'Support'
          })
        })
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'impersonation_started',
        entityId: 'imp-1'
      })
    );
  });

  it('rejects impersonation attempts from non-admin users', async () => {
    const actor = buildUser({ id: 'supervisor-1', role: UserRole.supervisor, organizationId: 'org-1' });
    usersService.findById.mockResolvedValue(actor);

    await expect(service.startImpersonation(actor.id, 'user-2', 'Support')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(prisma.impersonationSession.create).not.toHaveBeenCalled();
  });

  it('rejects impersonation of admin users and cross-organization targets', async () => {
    const actor = buildUser({ id: 'admin-1', role: UserRole.admin, organizationId: 'org-1' });
    const adminTarget = buildUser({ id: 'admin-2', role: UserRole.admin, organizationId: 'org-1' });
    const crossOrgTarget = buildUser({ id: 'user-3', role: UserRole.canvasser, organizationId: 'org-2' });

    usersService.findById.mockResolvedValueOnce(actor).mockResolvedValueOnce(adminTarget);
    await expect(service.startImpersonation(actor.id, adminTarget.id, 'Support')).rejects.toBeInstanceOf(
      BadRequestException
    );

    usersService.findById.mockResolvedValueOnce(actor).mockResolvedValueOnce(crossOrgTarget);
    await expect(service.startImpersonation(actor.id, crossOrgTarget.id, 'Support')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('returns the active impersonation session banner payload for the current admin', async () => {
    const target = buildUser({ id: 'user-2', role: UserRole.canvasser });
    prisma.impersonationSession.findFirst.mockResolvedValue({
      id: 'imp-1',
      startedAt: new Date('2026-03-29T21:00:00.000Z'),
      reasonText: 'Support',
      targetUser: target
    });

    await expect(service.getActiveImpersonation('admin-1')).resolves.toEqual({
      id: 'imp-1',
      startedAt: new Date('2026-03-29T21:00:00.000Z'),
      reasonText: 'Support',
      targetUser: target
    });
  });

  it('stops an active impersonation session for the current admin', async () => {
    const target = buildUser({ id: 'user-2', role: UserRole.canvasser });
    prisma.impersonationSession.findFirst.mockResolvedValue({
      id: 'imp-1',
      actorUserId: 'admin-1',
      targetUserId: target.id,
      organizationId: 'org-1',
      reasonText: 'Support',
      startedAt: new Date('2026-03-29T21:00:00.000Z'),
      endedAt: null,
      targetUser: target
    });
    prisma.impersonationSession.update.mockResolvedValue({
      id: 'imp-1',
      actorUserId: 'admin-1',
      targetUserId: target.id,
      organizationId: 'org-1',
      reasonText: 'Support',
      startedAt: new Date('2026-03-29T21:00:00.000Z'),
      endedAt: new Date('2026-03-29T22:00:00.000Z'),
      targetUser: target
    });

    const result = await service.stopImpersonation('admin-1', 'imp-1');

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        session: expect.objectContaining({
          id: 'imp-1',
          targetUser: target
        })
      })
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'impersonation_stopped',
        entityId: 'imp-1'
      })
    );
  });

  it('rejects stopping an impersonation session that is not active for the actor', async () => {
    prisma.impersonationSession.findFirst.mockResolvedValue(null);

    await expect(service.stopImpersonation('admin-1', 'missing-session')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(prisma.impersonationSession.update).not.toHaveBeenCalled();
  });
});
