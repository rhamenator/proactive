import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { MfaChallengePurpose, UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PoliciesService } from '../policies/policies.service';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { UsersService } from '../users/users.service';
import { buildOtpAuthUri, generateBase32Secret, verifyTotp } from './mfa.util';

@Injectable()
export class AuthService {
  private readonly authRateLimitState = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
    private readonly policiesService: PoliciesService,
    private readonly systemSettingsService: SystemSettingsService
  ) {}

  private readonly mfaIssuer = process.env.MFA_ISSUER ?? 'PROACTIVE FCS';
  private readonly exposeResetTokens = process.env.EXPOSE_RESET_TOKENS === 'true';

  private getImpersonationSessionStore() {
    return (this.prisma as PrismaService & {
      impersonationSession: {
        findFirst: (...args: any[]) => Promise<any>;
        updateMany: (...args: any[]) => Promise<any>;
        create: (...args: any[]) => Promise<any>;
        update: (...args: any[]) => Promise<any>;
      };
    }).impersonationSession;
  }

  private buildSafeUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    organizationId?: string | null;
    campaignId?: string | null;
    teamId?: string | null;
    isActive: boolean;
    status: string;
    mfaEnabled: boolean;
    invitedAt: Date | null;
    activatedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return this.usersService.sanitize({
      ...user,
      organizationId: user.organizationId ?? null,
      campaignId: user.campaignId ?? null,
      teamId: user.teamId ?? null
    });
  }

  private buildJwtPayload(user: {
    id: string;
    email: string;
    role: UserRole;
    organizationId?: string | null;
    campaignId?: string | null;
    teamId?: string | null;
  }, options?: { mfaVerifiedAt?: Date | null }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId ?? null,
      campaignId: user.campaignId ?? null,
      teamId: user.teamId ?? null,
      mfaVerifiedAt: options?.mfaVerifiedAt ? options.mfaVerifiedAt.toISOString() : null
    };
  }

  private createOpaqueToken() {
    return randomBytes(32).toString('hex');
  }

  private hashOpaqueToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private hoursFromNow(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60 * 1000);
  }

  private getRateLimitKey(action: string, identifier: string) {
    return `${action}:${identifier.trim().toLowerCase()}`;
  }

  private async assertWithinRateLimit(action: string, identifier: string) {
    const settings = await this.systemSettingsService.getEffectiveSettings();
    const key = this.getRateLimitKey(action, identifier);
    const now = Date.now();
    const entry = this.authRateLimitState.get(key);
    const windowMs = settings.authRateLimitWindowMinutes * 60 * 1000;

    if (!entry || entry.resetAt <= now) {
      this.authRateLimitState.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return;
    }

    if (entry.count >= settings.authRateLimitMaxAttempts) {
      throw new HttpException('Too many authentication attempts. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    entry.count += 1;
    this.authRateLimitState.set(key, entry);
  }

  private clearRateLimit(action: string, identifier: string) {
    this.authRateLimitState.delete(this.getRateLimitKey(action, identifier));
  }

  private requiresMfa(user: { role: UserRole; mfaEnabled: boolean }) {
    return user.role === UserRole.admin || user.role === UserRole.supervisor;
  }

  private async getAuthPolicy(scope?: { organizationId?: string | null; campaignId?: string | null }) {
    return this.policiesService.getEffectivePolicy({
      organizationId: scope?.organizationId ?? null,
      campaignId: scope?.campaignId ?? null
    });
  }

  private generateBackupCodeValue() {
    return `${randomBytes(2).toString('hex')}-${randomBytes(2).toString('hex')}`.toUpperCase();
  }

  private async replaceBackupCodes(user: { id: string; organizationId?: string | null; campaignId?: string | null }) {
    const policy = await this.getAuthPolicy(user);
    const backupCodes = Array.from({ length: policy.mfaBackupCodeCount }, () => this.generateBackupCodeValue());

    await this.prisma.$transaction(async (tx) => {
      await tx.mfaBackupCode.deleteMany({
        where: { userId: user.id }
      });

      await tx.mfaBackupCode.createMany({
        data: backupCodes.map((code) => ({
          userId: user.id,
          codeHash: this.hashOpaqueToken(code)
        }))
      });
    });

    return backupCodes;
  }

  private async consumeBackupCode(userId: string, code: string) {
    const storedCode = await this.prisma.mfaBackupCode.findFirst({
      where: {
        userId,
        codeHash: this.hashOpaqueToken(code.trim().toUpperCase()),
        usedAt: null
      }
    });

    if (!storedCode) {
      return false;
    }

    await this.prisma.mfaBackupCode.update({
      where: { id: storedCode.id },
      data: { usedAt: new Date() }
    });

    return true;
  }

  private async createMfaChallenge(
    user: { id: string; organizationId?: string | null; campaignId?: string | null },
    purpose: MfaChallengePurpose
  ) {
    await this.prisma.mfaChallengeToken.updateMany({
      where: {
        userId: user.id,
        purpose,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });

    const challengeToken = this.createOpaqueToken();
    const policy = await this.getAuthPolicy(user);
    await this.prisma.mfaChallengeToken.create({
      data: {
        userId: user.id,
        purpose,
        tokenHash: this.hashOpaqueToken(challengeToken),
        expiresAt: this.minutesFromNow(policy.mfaChallengeTtlMinutes)
      }
    });

    return challengeToken;
  }

  private async findMfaChallenge(token: string, purpose: MfaChallengePurpose) {
    return this.prisma.mfaChallengeToken.findFirst({
      where: {
        tokenHash: this.hashOpaqueToken(token),
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });
  }

  private async consumeMfaChallenge(id: string) {
    await this.prisma.mfaChallengeToken.update({
      where: { id },
      data: { usedAt: new Date() }
    });
  }

  private async markInteractiveLoginComplete(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date()
      }
    });
  }

  private async issueSession(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    organizationId?: string | null;
    campaignId?: string | null;
    teamId?: string | null;
    isActive: boolean;
    status: string;
    mfaEnabled: boolean;
    invitedAt: Date | null;
    activatedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }, options?: { mfaVerifiedAt?: Date | null }) {
    const payload = this.buildJwtPayload(user, options);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = this.createOpaqueToken();
    const policy = await this.getAuthPolicy(user);

    await this.prisma.authRefreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashOpaqueToken(refreshToken),
        expiresAt: this.daysFromNow(policy.refreshTokenTtlDays)
      }
    });

    return {
      accessToken,
      refreshToken,
      token: accessToken,
      role: user.role,
      user: this.buildSafeUser(user)
    };
  }

  private async issueAccessToken(payload: Record<string, unknown>) {
    return this.jwtService.signAsync(payload);
  }

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.assertWithinRateLimit('login', normalizedEmail);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.isActive || user.status !== 'active') {
      await this.auditService.log({
        actionType: 'login_failed',
        entityType: 'user_auth',
        entityId: normalizedEmail,
        reasonCode: 'INVALID_CREDENTIALS'
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditService.log({
        actorUserId: user.id,
        actionType: 'login_failed',
        entityType: 'user_auth',
        entityId: user.id,
        reasonCode: 'ACCOUNT_LOCKED'
      });
      throw new UnauthorizedException('Account is temporarily locked');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      const policy = await this.getAuthPolicy(user);
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedLoginAttempts >= policy.loginLockoutThreshold
          ? this.minutesFromNow(policy.loginLockoutMinutes)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts,
          lockedUntil,
          status: lockedUntil ? 'locked' : user.status
        }
      });

      await this.auditService.log({
        actorUserId: user.id,
        actionType: 'login_failed',
        entityType: 'user_auth',
        entityId: user.id,
        reasonCode: lockedUntil ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
        newValuesJson: {
          failedLoginAttempts,
          lockedUntil
        }
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.failedLoginAttempts || user.lockedUntil || user.status !== 'active' || !user.activatedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: 'active',
          activatedAt: user.activatedAt ?? new Date()
        }
      });
    }

    this.clearRateLimit('login', normalizedEmail);
    return this.usersService.findById(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    if (this.requiresMfa(user)) {
      const setupRequired = !user.mfaEnabled;
      const challengeToken = await this.createMfaChallenge(
        user,
        setupRequired ? MfaChallengePurpose.setup : MfaChallengePurpose.verify
      );

      await this.auditService.log({
        actorUserId: user.id,
        actionType: setupRequired ? 'mfa_setup_challenge_issued' : 'mfa_verify_challenge_issued',
        entityType: 'user_auth',
        entityId: user.id
      });

      return {
        mfaRequired: true,
        setupRequired,
        challengeToken,
        role: user.role,
        user: this.buildSafeUser(user)
      };
    }

    const session = await this.issueSession(user);
    await this.markInteractiveLoginComplete(user.id);

    await this.auditService.log({
      actorUserId: user.id,
      actionType: 'login_succeeded',
      entityType: 'user_auth',
      entityId: user.id
    });

    return session;
  }

  async initializeMfaSetup(challengeToken: string) {
    const challenge = await this.findMfaChallenge(challengeToken, MfaChallengePurpose.setup);

    if (!challenge) {
      throw new UnauthorizedException('Invalid or expired MFA setup challenge');
    }

    const secret = challenge.user.mfaTempSecret ?? generateBase32Secret();
    if (!challenge.user.mfaTempSecret) {
      await this.prisma.user.update({
        where: { id: challenge.userId },
        data: {
          mfaTempSecret: secret
        }
      });
    }

    return {
      secret,
      otpauthUri: buildOtpAuthUri({
        issuer: this.mfaIssuer,
        accountName: challenge.user.email,
        secret
      })
    };
  }

  async completeMfaSetup(challengeToken: string, code: string) {
    const challenge = await this.findMfaChallenge(challengeToken, MfaChallengePurpose.setup);

    if (!challenge || !challenge.user.mfaTempSecret) {
      throw new UnauthorizedException('Invalid or expired MFA setup challenge');
    }

    if (!verifyTotp(challenge.user.mfaTempSecret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.prisma.user.update({
      where: { id: challenge.userId },
      data: {
        mfaSecret: challenge.user.mfaTempSecret,
        mfaTempSecret: null,
        mfaEnabled: true
      }
    });
    await this.consumeMfaChallenge(challenge.id);
    const backupCodes = await this.replaceBackupCodes(challenge.user);

    const user = await this.usersService.findById(challenge.userId);
    const mfaVerifiedAt = new Date();
    const session = await this.issueSession(user, { mfaVerifiedAt });
    await this.markInteractiveLoginComplete(challenge.userId);

    await this.auditService.log({
      actorUserId: challenge.userId,
      actionType: 'mfa_enabled',
      entityType: 'user_auth',
      entityId: challenge.userId,
      newValuesJson: {
        backupCodeCount: backupCodes.length
      }
    });

    return {
      ...session,
      backupCodes
    };
  }

  async verifyMfaChallenge(challengeToken: string, code: string) {
    const challenge = await this.findMfaChallenge(challengeToken, MfaChallengePurpose.verify);

    if (!challenge || !challenge.user.mfaSecret) {
      throw new UnauthorizedException('Invalid or expired MFA verification challenge');
    }

    const normalizedCode = code.trim();
    const validTotp = verifyTotp(challenge.user.mfaSecret, normalizedCode);
    const usedBackupCode = validTotp ? false : await this.consumeBackupCode(challenge.userId, normalizedCode);
    if (!validTotp && !usedBackupCode) {
      throw new UnauthorizedException('Invalid MFA or backup code');
    }

    await this.consumeMfaChallenge(challenge.id);
    const mfaVerifiedAt = new Date();
    const session = await this.issueSession(challenge.user, { mfaVerifiedAt });
    await this.markInteractiveLoginComplete(challenge.userId);

    await this.auditService.log({
      actorUserId: challenge.userId,
      actionType: usedBackupCode ? 'mfa_backup_code_used' : 'mfa_verified',
      entityType: 'user_auth',
      entityId: challenge.userId
    });

    return session;
  }

  async mfaStatus(userId: string) {
    const user = await this.usersService.findById(userId);
    const backupCodeCount = user.mfaEnabled
      ? await this.prisma.mfaBackupCode.count({
          where: {
            userId,
            usedAt: null
          }
        })
      : 0;
    return {
      enabled: user.mfaEnabled,
      required: this.requiresMfa(user),
      backupCodeCount
    };
  }

  async disableMfa(userId: string, password: string, code: string) {
    const user = await this.usersService.findById(userId);

    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const normalizedCode = code.trim();
    const validTotp = verifyTotp(user.mfaSecret, normalizedCode);
    const usedBackupCode = validTotp ? false : await this.consumeBackupCode(user.id, normalizedCode);
    if (!validTotp && !usedBackupCode) {
      throw new UnauthorizedException('Invalid MFA or backup code');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaTempSecret: null
        }
      });

      await tx.mfaChallengeToken.updateMany({
        where: {
          userId,
          usedAt: null
        },
        data: {
          usedAt: new Date()
        }
      });

      await tx.mfaBackupCode.deleteMany({
        where: { userId }
      });
    });

    await this.auditService.log({
      actorUserId: userId,
      actionType: 'mfa_disabled',
      entityType: 'user_auth',
      entityId: userId,
      reasonCode: usedBackupCode ? 'BACKUP_CODE' : 'TOTP'
    });

    return { success: true, setupRequiredOnNextLogin: this.requiresMfa(user) };
  }

  async stepUpMfa(currentUser: { sub: string; impersonatorUserId?: string | null }, code: string) {
    if (currentUser.impersonatorUserId) {
      throw new ForbiddenException('Sensitive actions are unavailable during impersonation');
    }

    const user = await this.usersService.findById(currentUser.sub);

    if (!this.requiresMfa(user) || !user.mfaEnabled || !user.mfaSecret) {
      throw new ForbiddenException('MFA step-up is unavailable for this account');
    }

    const normalizedCode = code.trim();
    const validTotp = verifyTotp(user.mfaSecret, normalizedCode);
    const usedBackupCode = validTotp ? false : await this.consumeBackupCode(user.id, normalizedCode);
    if (!validTotp && !usedBackupCode) {
      throw new UnauthorizedException('Invalid MFA or backup code');
    }

    const mfaVerifiedAt = new Date();
    const accessToken = await this.issueAccessToken(this.buildJwtPayload(user, { mfaVerifiedAt }));
    const policy = await this.policiesService.getEffectivePolicy({
      organizationId: user.organizationId ?? null,
      campaignId: user.campaignId ?? null
    });

    await this.auditService.log({
      actorUserId: user.id,
      actionType: usedBackupCode ? 'mfa_step_up_backup_code_used' : 'mfa_step_up_verified',
      entityType: 'user_auth',
      entityId: user.id,
      newValuesJson: {
        validForMinutes: policy.sensitiveMfaWindowMinutes
      }
    });

    return {
      accessToken,
      token: accessToken,
      role: user.role,
      user: this.buildSafeUser(user)
    };
  }

  async getActiveImpersonation(actorUserId: string) {
    const session = await this.getImpersonationSessionStore().findFirst({
      where: {
        actorUserId,
        endedAt: null
      },
      include: {
        targetUser: true
      },
      orderBy: { startedAt: 'desc' }
    });

    if (!session) {
      return null;
    }

    return {
      id: session.id,
      startedAt: session.startedAt,
      reasonText: session.reasonText,
      targetUser: this.buildSafeUser(session.targetUser)
    };
  }

  async startImpersonation(actorUserId: string, targetUserId: string, reasonText?: string) {
    const actor = await this.usersService.findById(actorUserId);
    if (actor.role !== UserRole.admin) {
      throw new ForbiddenException('Only admins can start impersonation sessions');
    }

    const targetUser = await this.usersService.findById(targetUserId);
    if (targetUser.role === UserRole.admin) {
      throw new BadRequestException('Admins cannot impersonate other admin accounts');
    }
    if (targetUser.organizationId !== actor.organizationId) {
      throw new NotFoundException('User not found');
    }

    await this.getImpersonationSessionStore().updateMany({
      where: {
        actorUserId,
        endedAt: null
      },
      data: {
        endedAt: new Date()
      }
    });

    const session = await this.getImpersonationSessionStore().create({
      data: {
        actorUserId,
        targetUserId,
        organizationId: actor.organizationId ?? null,
        campaignId: null,
        reasonText: reasonText?.trim() || null
      },
      include: {
        targetUser: true
      }
    });
    const accessToken = await this.issueAccessToken({
      ...this.buildJwtPayload(targetUser),
      impersonationSessionId: session.id,
      impersonatorUserId: actor.id,
      impersonatorEmail: actor.email,
      impersonatorRole: actor.role,
      impersonatorName: `${actor.firstName} ${actor.lastName}`.trim(),
      impersonationStartedAt: session.startedAt.toISOString(),
      impersonationReasonText: session.reasonText ?? null
    });

    await this.auditService.log({
      actorUserId,
      actionType: 'impersonation_started',
      entityType: 'impersonation_session',
      entityId: session.id,
      reasonText: reasonText?.trim() || undefined,
      newValuesJson: {
        targetUserId,
        targetRole: targetUser.role
      }
    });

    return {
      accessToken,
      token: accessToken,
      role: targetUser.role,
      user: {
        ...this.buildSafeUser(session.targetUser),
        impersonation: {
          sessionId: session.id,
          actorUserId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          actorName: `${actor.firstName} ${actor.lastName}`.trim(),
          startedAt: session.startedAt,
          reasonText: session.reasonText
        }
      }
    };
  }

  async stopImpersonation(actorUserId: string, sessionId: string) {
    const session = await this.getImpersonationSessionStore().findFirst({
      where: {
        id: sessionId,
        actorUserId,
        endedAt: null
      },
      include: {
        targetUser: true
      }
    });

    if (!session) {
      throw new NotFoundException('Impersonation session not found');
    }

    const endedSession = await this.getImpersonationSessionStore().update({
      where: { id: sessionId },
      data: {
        endedAt: new Date()
      },
      include: {
        targetUser: true
      }
    });

    await this.auditService.log({
      actorUserId,
      actionType: 'impersonation_stopped',
      entityType: 'impersonation_session',
      entityId: sessionId,
      oldValuesJson: {
        targetUserId: session.targetUserId
      }
    });

    return {
      success: true,
      session: {
        id: endedSession.id,
        startedAt: endedSession.startedAt,
        endedAt: endedSession.endedAt,
        reasonText: endedSession.reasonText,
        targetUser: this.buildSafeUser(endedSession.targetUser)
      }
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashOpaqueToken(refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });

    if (!storedToken || !storedToken.user.isActive || storedToken.user.status !== 'active') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.authRefreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    await this.auditService.log({
      actorUserId: storedToken.userId,
      actionType: 'token_refreshed',
      entityType: 'user_auth',
      entityId: storedToken.userId
    });

    return this.issueSession(storedToken.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashOpaqueToken(refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null
      }
    });

    if (!storedToken) {
      return { success: true };
    }

    await this.prisma.authRefreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() }
    });

    await this.auditService.log({
      actorUserId: storedToken.userId,
      actionType: 'logout_succeeded',
      entityType: 'user_auth',
      entityId: storedToken.userId
    });

    return { success: true };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    await this.assertWithinRateLimit('password-reset', normalizedEmail);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      return { success: true };
    }
    const policy = await this.getAuthPolicy(user);

    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });

    const token = this.createOpaqueToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashOpaqueToken(token),
        expiresAt: this.minutesFromNow(policy.passwordResetTtlMinutes)
      }
    });

    await this.auditService.log({
      actorUserId: user.id,
      actionType: 'password_reset_requested',
      entityType: 'user_auth',
      entityId: user.id
    });

    const response = {
      success: true,
      expiresAt: this.minutesFromNow(policy.passwordResetTtlMinutes)
    } as { success: true; expiresAt: Date; resetToken?: string };

    if (this.exposeResetTokens) {
      response.resetToken = token;
    }

    return response;
  }

  async completePasswordReset(token: string, password: string) {
    const storedToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash: this.hashOpaqueToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: storedToken.userId },
        data: {
          passwordHash,
          isActive: true,
          status: 'active',
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      await tx.passwordResetToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() }
      });

      await tx.authRefreshToken.updateMany({
        where: {
          userId: storedToken.userId,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
    });

    await this.auditService.log({
      actorUserId: storedToken.userId,
      actionType: 'password_reset_completed',
      entityType: 'user_auth',
      entityId: storedToken.userId
    });

    return { success: true };
  }

  async createActivationForUser(userId: string) {
    const user = await this.usersService.findById(userId);
    await this.prisma.activationToken.updateMany({
      where: {
        userId,
        usedAt: null
      },
      data: {
        usedAt: new Date()
      }
    });

    const token = this.createOpaqueToken();
    const policy = await this.getAuthPolicy(user);
    const expiresAt = this.hoursFromNow(policy.activationTokenTtlHours);

    await this.prisma.activationToken.create({
      data: {
        userId,
        tokenHash: this.hashOpaqueToken(token),
        expiresAt
      }
    });

    await this.auditService.log({
      actorUserId: userId,
      actionType: 'activation_token_issued',
      entityType: 'user_auth',
      entityId: userId
    });

    return {
      activationToken: token,
      expiresAt
    };
  }

  async inviteCanvasser(input: {
    firstName: string;
    lastName: string;
    email: string;
    role?: UserRole;
    actorUserId: string;
    organizationId?: string | null;
    campaignId?: string | null;
    teamId?: string | null;
  }) {
    const placeholderPasswordHash = await bcrypt.hash(this.createOpaqueToken(), 10);
    const user = await this.usersService.createInvitedCanvasser({
      ...input,
      passwordHash: placeholderPasswordHash
    });
    const activation = await this.createActivationForUser(user.id);

    await this.auditService.log({
      actorUserId: input.actorUserId,
      actionType: 'field_user_invited',
      entityType: 'user',
      entityId: user.id,
      newValuesJson: {
        role: user.role
      }
    });

    return {
      user,
      ...activation
    };
  }

  async activateAccount(token: string, password: string) {
    const storedToken = await this.prisma.activationToken.findFirst({
      where: {
        tokenHash: this.hashOpaqueToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: true
      }
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired activation token');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: storedToken.userId },
        data: {
          passwordHash,
          isActive: true,
          status: 'active',
          activatedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      });

      await tx.activationToken.update({
        where: { id: storedToken.id },
        data: { usedAt: new Date() }
      });
    });

    const user = await this.usersService.findById(storedToken.userId);
    await this.auditService.log({
      actorUserId: storedToken.userId,
      actionType: 'account_activated',
      entityType: 'user_auth',
      entityId: storedToken.userId
    });

    if (this.requiresMfa(user)) {
      const setupRequired = !user.mfaEnabled;
      const challengeToken = await this.createMfaChallenge(
        user,
        setupRequired ? MfaChallengePurpose.setup : MfaChallengePurpose.verify
      );

      await this.auditService.log({
        actorUserId: user.id,
        actionType: setupRequired ? 'mfa_setup_challenge_issued' : 'mfa_verify_challenge_issued',
        entityType: 'user_auth',
        entityId: user.id,
        reasonText: 'post_activation'
      });

      return {
        mfaRequired: true,
        setupRequired,
        challengeToken,
        role: user.role,
        user: this.buildSafeUser(user)
      };
    }

    return this.issueSession(user);
  }
}
