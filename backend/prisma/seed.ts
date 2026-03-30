import { PrismaClient, Prisma, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import { buildNormalizedAddressKey } from '../src/common/utils/address-normalization.util';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const organization = await prisma.organization.upsert({
    where: { code: 'default' },
    update: {},
    create: {
      code: 'default',
      name: 'PROACTIVE Default Organization'
    }
  });

  const campaign = await prisma.campaign.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: 'general'
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      code: 'general',
      name: 'General'
    }
  });

  const defaultOutcomes: Array<Prisma.OutcomeDefinitionCreateInput> = [
    { code: 'knocked', label: 'Knocked', displayOrder: 10 },
    { code: 'lit_drop', label: 'Lit Drop', displayOrder: 20 },
    { code: 'not_home', label: 'Not Home', displayOrder: 30 },
    { code: 'refused', label: 'Refused', requiresNote: true, displayOrder: 40 },
    { code: 'talked_to_voter', label: 'Talked to Voter', displayOrder: 50 },
    { code: 'other', label: 'Other', requiresNote: true, displayOrder: 60 }
  ];

  for (const outcome of defaultOutcomes) {
    const existing = await prisma.outcomeDefinition.findFirst({
      where: {
        organizationId: organization.id,
        campaignId: campaign.id,
        code: outcome.code
      }
    });

    if (existing) {
      await prisma.outcomeDefinition.update({
        where: { id: existing.id },
        data: {
          label: outcome.label,
          requiresNote: outcome.requiresNote ?? false,
          displayOrder: outcome.displayOrder,
          isFinalDisposition: true,
          isActive: true
        }
      });
      continue;
    }

    await prisma.outcomeDefinition.create({
      data: {
        code: outcome.code,
        label: outcome.label,
        requiresNote: outcome.requiresNote ?? false,
        displayOrder: outcome.displayOrder,
        isFinalDisposition: true,
        isActive: true,
        organizationId: organization.id,
        campaignId: campaign.id
      }
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: 'admin@proactive.local' },
    update: {},
    create: {
      firstName: 'Field',
      lastName: 'Director',
      email: 'admin@proactive.local',
      passwordHash,
      role: UserRole.admin,
      organizationId: organization.id,
      campaignId: campaign.id
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
      role: UserRole.canvasser,
      organizationId: organization.id,
      campaignId: campaign.id
    }
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@proactive.local' },
    update: {},
    create: {
      firstName: 'Sample',
      lastName: 'Supervisor',
      email: 'supervisor@proactive.local',
      passwordHash,
      role: UserRole.supervisor,
      organizationId: organization.id,
      campaignId: campaign.id
    }
  });

  const turf = await prisma.turf.create({
    data: {
      name: 'Sample Turf 1',
      description: 'Starter turf for local development',
      createdById: admin.id,
      organizationId: organization.id,
      campaignId: campaign.id
    }
  });

  const households = await Promise.all([
    prisma.household.create({
      data: {
        organizationId: organization.id,
        addressLine1: '100 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        normalizedAddressKey: buildNormalizedAddressKey({
          addressLine1: '100 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        }),
        latitude: 42.9634,
        longitude: -85.6681,
        vanHouseholdId: 'VAN-1001',
        source: 'seed',
        approvalStatus: 'approved'
      }
    }),
    prisma.household.create({
      data: {
        organizationId: organization.id,
        addressLine1: '102 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        normalizedAddressKey: buildNormalizedAddressKey({
          addressLine1: '102 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        }),
        latitude: 42.9635,
        longitude: -85.6682,
        vanHouseholdId: 'VAN-1002',
        source: 'seed',
        approvalStatus: 'approved'
      }
    })
  ]);

  await prisma.address.createMany({
    data: [
      {
        turfId: turf.id,
        householdId: households[0].id,
        organizationId: organization.id,
        campaignId: campaign.id,
        addressLine1: '100 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        normalizedAddressKey: buildNormalizedAddressKey({
          addressLine1: '100 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        }),
        latitude: 42.9634,
        longitude: -85.6681,
        vanId: 'VAN-1001'
      },
      {
        turfId: turf.id,
        householdId: households[1].id,
        organizationId: organization.id,
        campaignId: campaign.id,
        addressLine1: '102 Main St',
        city: 'Grand Rapids',
        state: 'MI',
        zip: '49503',
        normalizedAddressKey: buildNormalizedAddressKey({
          addressLine1: '102 Main St',
          city: 'Grand Rapids',
          state: 'MI',
          zip: '49503'
        }),
        latitude: 42.9635,
        longitude: -85.6682,
        vanId: 'VAN-1002'
      }
    ]
  });

  await prisma.turfAssignment.create({
    data: {
      turfId: turf.id,
      canvasserId: canvasser.id,
      organizationId: organization.id,
      campaignId: campaign.id
    }
  });

  console.log('Seeded organization, campaign, outcomes, users, turf, and addresses.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
