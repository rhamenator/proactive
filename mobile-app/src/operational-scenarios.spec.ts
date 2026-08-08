import {
  createOperationalScenario,
  operationalScenarioNames
} from '../../testing/fake-data/scenarios';
import { describe, expect, it } from 'vitest';

describe('privacy-safe operational scenarios', () => {
  it('builds every documented scenario deterministically', () => {
    for (const name of operationalScenarioNames) {
      const rows = name === 'bounded-high-volume' ? 100 : undefined;
      const first = createOperationalScenario(name, 'scenario-test', rows);
      const second = createOperationalScenario(name, 'scenario-test', rows);

      expect(first).toEqual(second);
      expect(first.scenarioManifest).toEqual(expect.objectContaining({ name, synthetic: true }));
      expect(first.addresses).toHaveLength(rows ?? (name === 'sync-recovery' ? 15 : name === 'clean-lifecycle' ? 25 : 12));
      expect(first.visits).toHaveLength(first.addresses.length);
      expect(first.addresses.every((address) => address.vanId.startsWith('MOCK-V-SCENARIO-'))).toBe(true);
      if (name === 'clean-lifecycle') {
        expect(first.visits.filter((visit) => visit.syncStatus === 'conflict')).toHaveLength(0);
      }
    }
  });

  it('models duplicate, encoding, and sync-recovery edge cases', () => {
    const duplicates = createOperationalScenario('duplicate-strategies', 'duplicates');
    expect(duplicates.addresses[1]).toEqual(expect.objectContaining({
      addressLine1: duplicates.addresses[0].addressLine1,
      zip: duplicates.addresses[0].zip,
      vanHouseholdId: duplicates.addresses[0].vanHouseholdId,
      vanPersonId: duplicates.addresses[0].vanPersonId,
      vanId: duplicates.addresses[0].vanId
    }));
    expect(duplicates.visits[1].addressLine1).toBe(duplicates.addresses[0].addressLine1);

    const encoding = createOperationalScenario('encoding-edge-cases', 'encoding');
    expect(encoding.addresses[0]).toEqual(expect.objectContaining({ zip: '00123', unit: 'Mock Unit 01' }));
    expect(encoding.visits[1].notes).toContain('\n');

    const sync = createOperationalScenario('sync-recovery', 'sync');
    expect(sync.visits.map((visit) => visit.syncStatus)).toEqual(
      expect.arrayContaining(['pending', 'failed', 'conflict'])
    );
    expect(sync.visits.filter((visit) => visit.syncStatus === 'pending')).toHaveLength(1);
    expect(sync.visits.filter((visit) => visit.syncStatus === 'failed')).toHaveLength(1);
    expect(sync.visits.filter((visit) => visit.syncStatus === 'conflict')).toHaveLength(1);
    expect(sync.visits.some((visit) => visit.notes?.includes('correction'))).toBe(true);
  });

  it('rejects scenario row counts that cannot contain their required edge cases', () => {
    expect(() => createOperationalScenario('duplicate-strategies', 'small', 1)).toThrow(
      'duplicate-strategies requires at least 2 rows'
    );
    expect(() => createOperationalScenario('encoding-edge-cases', 'small', 1)).toThrow(
      'encoding-edge-cases requires at least 2 rows'
    );
    expect(() => createOperationalScenario('sync-recovery', 'small', 5)).toThrow(
      'sync-recovery requires at least 6 rows'
    );
  });
});
