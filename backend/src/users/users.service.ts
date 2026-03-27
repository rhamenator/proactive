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
    createdAt: Date;
  }): SafeUser {
    return { ...user };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
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
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        role: UserRole.canvasser
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
    if (input.email !== undefined) data.email = input.email;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.password !== undefined) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data
    });

    return this.sanitize(user);
  }
}
