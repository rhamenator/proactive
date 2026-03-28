import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

export type SafeUser = {
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
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  sanitize(user: {
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
  }): SafeUser {
    return {
      ...user,
      status: user.status ?? 'active',
      mfaEnabled: user.mfaEnabled ?? false,
      invitedAt: user.invitedAt ?? null,
      activatedAt: user.activatedAt ?? null,
      lastLoginAt: user.lastLoginAt ?? null
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async listCanvassers() {
    const users = await this.prisma.user.findMany({
      where: { role: UserRole.canvasser },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    });
    return users.map((user) => this.sanitize(user));
  }

  async createCanvasser(input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizedEmail,
        passwordHash,
        role: UserRole.canvasser,
        status: 'active',
        activatedAt: new Date()
      }
    });

    return this.sanitize(user);
  }

  async updateCanvasser(
    id: string,
    input: Partial<{ firstName: string; lastName: string; email: string; password: string; isActive: boolean }>
  ) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    const data: Prisma.UserUpdateInput = {};
    if (input.firstName !== undefined) data.firstName = input.firstName;
    if (input.lastName !== undefined) data.lastName = input.lastName;
    if (input.email !== undefined) data.email = input.email.trim().toLowerCase();
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
      data.status = input.isActive ? 'active' : 'inactive';
    }
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data
    });

    return this.sanitize(user);
  }

  async createInvitedCanvasser(input: {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: normalizedEmail,
        passwordHash: input.passwordHash,
        role: UserRole.canvasser,
        isActive: false,
        status: 'invited',
        invitedAt: new Date()
      }
    });

    return this.sanitize(user);
  }
}
