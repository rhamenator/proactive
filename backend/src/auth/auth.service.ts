import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService
  ) {}

  private readonly refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14);
  private readonly activationTokenTtlHours = Number(process.env.ACTIVATION_TOKEN_TTL_HOURS ?? 48);
  private readonly passwordResetTtlMinutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES ?? 30);
  private readonly loginLockoutThreshold = Number(process.env.LOGIN_LOCKOUT_THRESHOLD ?? 5);
  private readonly loginLockoutMinutes = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15);

  private buildSafeUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    status: string;
    mfaEnabled: boolean;
    invitedAt: Date | null;
    activatedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return this.usersService.sanitize(user);
  }

  private buildJwtPayload(user: { id: string; email: string; role: UserRole }) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role
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

  private async issueSession(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    status: string;
    mfaEnabled: boolean;
    invitedAt: Date | null;
    activatedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    const payload = this.buildJwtPayload(user);
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = this.createOpaqueToken();

    await this.prisma.authRefreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashOpaqueToken(refreshToken),
        expiresAt: this.daysFromNow(this.refreshTokenTtlDays)
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

  async validateUser(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
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
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedUntil =
        failedLoginAttempts >= this.loginLockoutThreshold
          ? this.minutesFromNow(this.loginLockoutMinutes)
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
          activatedAt: user.activatedAt ?? new Date(),
          lastLoginAt: new Date()
        }
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date()
        }
      });
    }

    return this.usersService.findById(user.id);
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const session = await this.issueSession(user);

    await this.auditService.log({
      actorUserId: user.id,
      actionType: 'login_succeeded',
      entityType: 'user_auth',
      entityId: user.id
    });

    return session;
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
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      return { success: true };
    }

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
        expiresAt: this.minutesFromNow(this.passwordResetTtlMinutes)
      }
    });

    await this.auditService.log({
      actorUserId: user.id,
      actionType: 'password_reset_requested',
      entityType: 'user_auth',
      entityId: user.id
    });

    return {
      success: true,
      resetToken: token,
      expiresAt: this.minutesFromNow(this.passwordResetTtlMinutes)
    };
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
    const expiresAt = this.hoursFromNow(this.activationTokenTtlHours);

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
  }) {
    const placeholderPasswordHash = await bcrypt.hash(this.createOpaqueToken(), 10);
    const user = await this.usersService.createInvitedCanvasser({
      ...input,
      passwordHash: placeholderPasswordHash
    });
    const activation = await this.createActivationForUser(user.id);

    await this.auditService.log({
      actorUserId: user.id,
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

    return this.issueSession(user);
  }
}
