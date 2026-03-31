import bcrypt from 'bcrypt';
import {
  AddressRequestStatus,
  AssignmentStatus,
  GpsStatus,
  PrismaClient,
  SessionStatus,
  SupervisorScopeMode,
  SyncStatus,
  TurfStatus,
  UserRole,
  VisitResult,
  VisitSource
} from '@prisma/client';
import { buildNormalizedAddressKey } from '../src/common/utils/address-normalization.util';

const prisma = new PrismaClient();

function requireSafeSeedEnvironment() {
  if (process.env.E2E_ALLOW_DATABASE_SEED !== 'true') {
    throw new Error('Refusing to seed e2e data. Set E2E_ALLOW_DATABASE_SEED=true to continue.');
  }
}

async function resetScopedData(organizationId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.exportBatchVisit.deleteMany({ where: { exportBatch: { organizationId } } });
    await tx.exportBatch.deleteMany({ where: { organizationId } });
    await tx.visitGeofenceResult.deleteMany({ where: { visitLog: { organizationId } } });
    await tx.visitLog.deleteMany({ where: { organizationId } });
    await tx.turfSession.deleteMany({ where: { organizationId } });
    await tx.turfAssignment.deleteMany({ where: { organizationId } });
    await tx.addressRequest.deleteMany({ where: { organizationId } });
    await tx.importBatchRow.deleteMany({ where: { importBatch: { organizationId } } });
    await tx.importBatch.deleteMany({ where: { organizationId } });
    await tx.address.deleteMany({ where: { organizationId } });
    await tx.household.deleteMany({ where: { organizationId } });
    await tx.turf.deleteMany({ where: { organizationId } });
    await tx.outcomeDefinition.deleteMany({ where: { organizationId } });
    await tx.operationalPolicy.deleteMany({ where: { organizationId } });
    await tx.csvProfile.deleteMany({ where: { organizationId } });
    await tx.team.deleteMany({ where: { organizationId } });
    await tx.campaign.deleteMany({ where: { organizationId } });
    await tx.user.deleteMany({ where: { organizationId } });
  });
}

async function main() {
  requireSafeSeedEnvironment();

  const scenario = {
    org: { code: 'org_seeded-e2e', name: 'PROACTIVE QA Organization' },
    campaign: { code: 'spring_gotv', name: 'Spring GOTV' },
    team: { code: 'NORTH', name: 'North Team', regionCode: 'REG-NORTH' },
    admin: { firstName: 'Alex', lastName: 'Admin', email: 'admin.e2e@example.test' },
    supervisor: { firstName: 'Morgan', lastName: 'Supervisor', email: 'supervisor.e2e@example.test' },
    canvasser: { firstName: 'Casey', lastName: 'Canvasser', email: 'canvasser.e2e@example.test' },
    turf: { name: 'North Side Turf', description: 'North Side seeded turf' },
    addresses: [
      {
        addressLine1: '101 Main St',
        addressLine2: null,
        unit: null,
        city: 'Detroit',
        state: 'MI',
        zip: '48201',
        vanHouseholdId: 'HH-SEEDED-E2E-1',
        vanPersonId: 'P-SEEDED-E2E-1',
        vanId: 'VAN-SEEDED-E2E-1',
        latitude: 42.961,
        longitude: -85.671
      },
      {
        addressLine1: '102 Main St',
        addressLine2: 'Apt 2',
        unit: '2',
        city: 'Detroit',
        state: 'MI',
        zip: '48201',
        vanHouseholdId: 'HH-SEEDED-E2E-2',
        vanPersonId: 'P-SEEDED-E2E-2',
        vanId: 'VAN-SEEDED-E2E-2',
        latitude: 42.962,
        longitude: -85.672
      }
    ],
    visits: [
      {
        localRecordUuid: 'seeded-e2e-local-1',
        idempotencyKey: 'seeded-e2e-idem-1',
        addressLine1: '101 Main St',
        visitTimeIso: '2026-03-30T06:30:00.000Z',
        result: 'talked_to_voter',
        outcomeCode: 'talked_to_voter',
        outcomeLabel: 'Talked to Voter',
        contactMade: true,
        syncStatus: 'synced',
        syncConflictFlag: false,
        syncConflictReason: null,
        gpsStatus: 'verified',
        geofenceValidated: true,
        notes: 'Spoke with voter'
      },
      {
        localRecordUuid: 'seeded-e2e-local-2',
        idempotencyKey: 'seeded-e2e-idem-2',
        addressLine1: '102 Main St',
        visitTimeIso: '2026-03-30T23:45:00.000Z',
        result: 'knocked',
        outcomeCode: 'knocked',
        outcomeLabel: 'Knocked',
        contactMade: false,
        syncStatus: 'conflict',
        syncConflictFlag: true,
        syncConflictReason: 'payload_mismatch',
        gpsStatus: 'flagged',
        geofenceValidated: false,
        notes: null
      }
    ],
    importBatch: {
      filename: 'detroit-import.csv',
      mode: 'replace_turf_membership',
      duplicateStrategy: 'review',
      rowCount: 8,
      importedCount: 6,
      pendingReviewCount: 1
    },
    exportBatch: {
      profileCode: 'van_compatible',
      profileName: 'VAN Compatible',
      filename: 'van-results-2026-03-30.csv',
      markExported: true
    },
    pendingAddressRequest: {
      addressLine1: '555 Added Ave',
      addressLine2: 'Apt 9',
      unit: '9',
      city: 'Detroit',
      state: 'MI',
      zip: '48201',
      notes: 'Added from field'
    },
    mfaSecret: 'JBSWY3DPEHPK3PXP'
  };
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const organization = await prisma.organization.upsert({
    where: { code: scenario.org.code },
    update: { name: scenario.org.name },
    create: {
      code: scenario.org.code,
      name: scenario.org.name
    }
  });

  await resetScopedData(organization.id);

  const campaign = await prisma.campaign.create({
    data: {
      organizationId: organization.id,
      code: scenario.campaign.code,
      name: scenario.campaign.name,
      isActive: true
    }
  });

  const team = await prisma.team.create({
    data: {
      organizationId: organization.id,
      campaignId: campaign.id,
      code: scenario.team.code,
      name: scenario.team.name,
      regionCode: scenario.team.regionCode,
      isActive: true
    }
  });

  const [admin, supervisor, canvasser] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: scenario.admin.firstName,
        lastName: scenario.admin.lastName,
        email: scenario.admin.email,
        passwordHash,
        role: UserRole.admin,
        organizationId: organization.id,
        campaignId: campaign.id,
        teamId: team.id,
        regionCode: team.regionCode,
        mfaEnabled: true,
        mfaSecret: scenario.mfaSecret,
        activatedAt: new Date()
      }
    }),
    prisma.user.create({
      data: {
        firstName: scenario.supervisor.firstName,
        lastName: scenario.supervisor.lastName,
        email: scenario.supervisor.email,
        passwordHash,
        role: UserRole.supervisor,
        organizationId: organization.id,
        campaignId: campaign.id,
        teamId: team.id,
        regionCode: team.regionCode,
        mfaEnabled: true,
        mfaSecret: scenario.mfaSecret,
        activatedAt: new Date()
      }
    }),
    prisma.user.create({
      data: {
        firstName: scenario.canvasser.firstName,
        lastName: scenario.canvasser.lastName,
        email: scenario.canvasser.email,
        passwordHash,
        role: UserRole.canvasser,
        organizationId: organization.id,
        campaignId: campaign.id,
        teamId: team.id,
        regionCode: team.regionCode,
        mfaEnabled: false,
        activatedAt: new Date()
      }
    })
  ]);

  await prisma.operationalPolicy.create({
    data: {
      scopeKey: `${organization.id}:org`,
      organizationId: organization.id,
      campaignId: null,
      supervisorScopeMode: SupervisorScopeMode.team,
      defaultImportProfileCode: 'van_standard',
      defaultImportMode: 'replace_turf_membership',
      defaultDuplicateStrategy: 'review',
      defaultVanExportProfileCode: 'van_compatible',
      defaultInternalExportProfileCode: 'internal_master',
      sensitiveMfaWindowMinutes: 5,
      maxAttemptsPerHousehold: 3,
      minMinutesBetweenAttempts: 5,
      geofenceRadiusFeet: 75,
      gpsLowAccuracyMeters: 30,
      loginLockoutThreshold: 5,
      loginLockoutMinutes: 15,
      mfaChallengeTtlMinutes: 10,
      mfaBackupCodeCount: 10
    }
  });

  await prisma.csvProfile.createMany({
    data: [
      {
        direction: 'import',
        code: 'van_standard',
        name: 'VAN Standard Import',
        organizationId: organization.id,
        campaignId: campaign.id,
        isActive: true,
        mappingJson: { addressLine1: 'address', city: 'city', state: 'state' },
        settingsJson: {}
      },
      {
        direction: 'export',
        code: 'van_compatible',
        name: 'VAN Compatible',
        organizationId: organization.id,
        campaignId: campaign.id,
        isActive: true,
        mappingJson: {},
        settingsJson: { markExportedDefault: true }
      },
      {
        direction: 'export',
        code: 'internal_master',
        name: 'Internal Master',
        organizationId: organization.id,
        campaignId: campaign.id,
        isActive: true,
        mappingJson: {},
        settingsJson: {}
      }
    ]
  });

  const outcomes = await Promise.all([
    prisma.outcomeDefinition.create({
      data: {
        code: 'knocked',
        label: 'Knocked',
        displayOrder: 10,
        organizationId: organization.id,
        campaignId: campaign.id,
        isFinalDisposition: true,
        isActive: true
      }
    }),
    prisma.outcomeDefinition.create({
      data: {
        code: 'talked_to_voter',
        label: 'Talked to Voter',
        displayOrder: 20,
        organizationId: organization.id,
        campaignId: campaign.id,
        isFinalDisposition: true,
        isActive: true
      }
    })
  ]);

  const turf = await prisma.turf.create({
    data: {
      name: scenario.turf.name,
      description: scenario.turf.description,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      status: TurfStatus.in_progress,
      createdById: admin.id
    }
  });

  await prisma.turfAssignment.create({
    data: {
      turfId: turf.id,
      canvasserId: canvasser.id,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      assignedByUserId: supervisor.id,
      status: AssignmentStatus.active
    }
  });

  const session = await prisma.turfSession.create({
    data: {
      turfId: turf.id,
      canvasserId: canvasser.id,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      startTime: new Date('2026-03-30T06:00:00.000Z'),
      endTime: new Date('2026-03-30T08:00:00.000Z'),
      status: SessionStatus.ended,
      lastActivityAt: new Date('2026-03-30T08:00:00.000Z')
    }
  });

  const households = await Promise.all(
    scenario.addresses.map((item) =>
      prisma.household.create({
        data: {
          organizationId: organization.id,
          addressLine1: item.addressLine1,
          addressLine2: item.addressLine2,
          unit: item.unit,
          city: item.city,
          state: item.state,
          zip: item.zip,
          normalizedAddressKey: buildNormalizedAddressKey(item),
          latitude: item.latitude,
          longitude: item.longitude,
          vanHouseholdId: item.vanHouseholdId,
          vanPersonId: item.vanPersonId,
          source: 'seed',
          approvalStatus: 'approved'
        }
      })
    )
  );

  const addresses = await Promise.all(
    scenario.addresses.map((item, index) =>
      prisma.address.create({
        data: {
          turfId: turf.id,
          householdId: households[index].id,
          organizationId: organization.id,
          campaignId: campaign.id,
          teamId: team.id,
          regionCode: team.regionCode,
          addressLine1: item.addressLine1,
          addressLine2: item.addressLine2,
          unit: item.unit,
          city: item.city,
          state: item.state,
          zip: item.zip,
          normalizedAddressKey: buildNormalizedAddressKey(item),
          latitude: item.latitude,
          longitude: item.longitude,
          vanId: item.vanId,
          addedInField: false
        }
      })
    )
  );

  const visitByLocalId = new Map<string, { id: string }>();

  for (const item of scenario.visits) {
    const address = addresses.find((candidate) => candidate.addressLine1 === item.addressLine1);
    const outcomeDefinition = outcomes.find((candidate) => candidate.code === item.outcomeCode);
    if (!address || !outcomeDefinition) {
      throw new Error('Seed visit references missing address/outcome');
    }

    const visit = await prisma.visitLog.create({
      data: {
        turfId: turf.id,
        addressId: address.id,
        sessionId: session.id,
        canvasserId: canvasser.id,
        organizationId: organization.id,
        campaignId: campaign.id,
        teamId: team.id,
        regionCode: team.regionCode,
        outcomeDefinitionId: outcomeDefinition.id,
        visitTime: new Date(item.visitTimeIso),
        clientCreatedAt: new Date(item.visitTimeIso),
        localRecordUuid: item.localRecordUuid,
        idempotencyKey: item.idempotencyKey,
        syncStatus: item.syncStatus as SyncStatus,
        syncConflictFlag: item.syncConflictFlag,
        syncConflictReason: item.syncConflictReason,
        source: VisitSource.mobile_app,
        latitude: address.latitude,
        longitude: address.longitude,
        accuracyMeters: 8,
        gpsStatus: item.gpsStatus as GpsStatus,
        result: item.result as VisitResult,
        outcomeCode: item.outcomeCode,
        outcomeLabel: item.outcomeLabel,
        contactMade: item.contactMade,
        notes: item.notes,
        vanExported: false,
        geofenceValidated: item.geofenceValidated,
        geofenceDistanceMeters: item.gpsStatus === 'verified' ? 12 : 200
      }
    });

    visitByLocalId.set(item.localRecordUuid, { id: visit.id });

    await prisma.visitGeofenceResult.create({
      data: {
        visitLogId: visit.id,
        addressId: address.id,
        targetLatitude: address.latitude,
        targetLongitude: address.longitude,
        capturedLatitude: address.latitude,
        capturedLongitude: address.longitude,
        accuracyMeters: 8,
        distanceFromTargetFeet: item.gpsStatus === 'verified' ? 20 : 300,
        validationRadiusFeet: 75,
        gpsStatus: item.gpsStatus as GpsStatus,
        failureReason: item.gpsStatus === 'verified' ? null : 'outside_radius',
        capturedAt: new Date(item.visitTimeIso),
        overrideFlag: false
      }
    });
  }

  const importBatch = await prisma.importBatch.create({
    data: {
      profileCode: 'van_standard',
      profileName: 'VAN Standard Import',
      filename: scenario.importBatch.filename,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      initiatedByUserId: admin.id,
      mode: scenario.importBatch.mode,
      duplicateStrategy: scenario.importBatch.duplicateStrategy,
      rowCount: scenario.importBatch.rowCount,
      importedCount: scenario.importBatch.importedCount,
      pendingReviewCount: scenario.importBatch.pendingReviewCount,
      mappingJson: { addressLine1: 'address', city: 'city', state: 'state' },
      csvContent: 'address,city,state\n101 Main St,Detroit,MI\n'
    }
  });

  await prisma.importBatchRow.create({
    data: {
      importBatchId: importBatch.id,
      rowIndex: 3,
      turfName: turf.name,
      status: 'pending_review',
      reasonCode: 'duplicate_address',
      rawRowJson: { address: '101 Main St', city: 'Detroit', state: 'MI' },
      candidateAddressId: addresses[0].id
    }
  });

  const exportBatch = await prisma.exportBatch.create({
    data: {
      profileCode: scenario.exportBatch.profileCode,
      profileName: scenario.exportBatch.profileName,
      filename: scenario.exportBatch.filename,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      turfId: turf.id,
      initiatedByUserId: admin.id,
      markExported: scenario.exportBatch.markExported,
      rowCount: scenario.visits.length,
      csvContent: 'event_time,time_zone\n2026-03-30T06:30:00.000Z,UTC\n',
      sha256Checksum: 'seeded-checksum'
    }
  });

  const conflictVisit = scenario.visits.find((item) => item.syncConflictFlag);
  if (conflictVisit) {
    const visit = visitByLocalId.get(conflictVisit.localRecordUuid);
    if (visit) {
      await prisma.exportBatchVisit.create({
        data: {
          exportBatchId: exportBatch.id,
          visitLogId: visit.id,
          rowIndex: 1,
          rowSnapshotJson: { localRecordUuid: conflictVisit.localRecordUuid }
        }
      });
    }
  }

  await prisma.addressRequest.create({
    data: {
      turfId: turf.id,
      organizationId: organization.id,
      campaignId: campaign.id,
      teamId: team.id,
      regionCode: team.regionCode,
      requestedByUserId: canvasser.id,
      status: AddressRequestStatus.pending,
      addressLine1: scenario.pendingAddressRequest.addressLine1,
      city: scenario.pendingAddressRequest.city,
      state: scenario.pendingAddressRequest.state,
      zip: scenario.pendingAddressRequest.zip,
      latitude: 42.975,
      longitude: -85.68,
      notes: scenario.pendingAddressRequest.notes
    }
  });

  console.log(
    JSON.stringify({
      organizationCode: scenario.org.code,
      adminEmail: scenario.admin.email,
      supervisorEmail: scenario.supervisor.email,
      canvasserEmail: scenario.canvasser.email,
      password: 'Password123!',
      mfaSecret: scenario.mfaSecret
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
