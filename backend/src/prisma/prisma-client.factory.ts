import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

export function createPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  return new PrismaPg({ connectionString });
}

export function createPrismaClient() {
  return new PrismaClient({ adapter: createPrismaAdapter() });
}
