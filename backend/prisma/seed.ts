import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@proactive.local' },
    update: {},
    create: {
      firstName: 'Field',
      lastName: 'Director',
      email: 'admin@proactive.local',
      passwordHash,
      role: UserRole.admin
    }
  });

  const canvasser = await prisma.user.upsert({
    where: { email: 'canvasser@proactive.local' },
    update: {},
    create: {
      firstName: 'Sample',
      lastName: 'Canvasser',
      email: 'canvasser@proactive.local',
      passwordHash,
      role: UserRole.canvasser
    }
  });

  const turf = await prisma.turf.create({
    data: {
      name: 'Sample Turf 1',
      description: 'Starter turf for local development',
      createdById: admin.id,
      addresses: {
        create: [
          {
            addressLine1: '100 Main St',
            city: 'Grand Rapids',
            state: 'MI',
            zip: '49503',
            latitude: 42.9634,
            longitude: -85.6681,
            vanId: 'VAN-1001'
          },
          {
            addressLine1: '102 Main St',
            city: 'Grand Rapids',
            state: 'MI',
            zip: '49503',
            latitude: 42.9635,
            longitude: -85.6682,
            vanId: 'VAN-1002'
          }
        ]
      }
    }
  });

  await prisma.turfAssignment.create({
    data: {
      turfId: turf.id,
      canvasserId: canvasser.id
    }
  });

  console.log('Seeded users, turf, and addresses.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
