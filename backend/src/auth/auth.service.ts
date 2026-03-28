import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService
  ) {}

  private buildSafeUser(user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
  }) {
    return this.usersService.sanitize(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      await this.auditService.log({
        actionType: 'login_failed',
        entityType: 'user_auth',
        entityId: email,
        reasonCode: 'INVALID_CREDENTIALS'
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      await this.auditService.log({
        actorUserId: user.id,
        actionType: 'login_failed',
        entityType: 'user_auth',
        entityId: user.id,
        reasonCode: 'INVALID_CREDENTIALS'
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role
    };
    const accessToken = await this.jwtService.signAsync(payload);

    await this.auditService.log({
      actorUserId: user.id,
      actionType: 'login_succeeded',
      entityType: 'user_auth',
      entityId: user.id
    });

    return {
      accessToken,
      token: accessToken,
      role: user.role,
      user: this.buildSafeUser(user)
    };
  }
}
