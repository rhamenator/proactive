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
    }
  });

  it('models duplicate, encoding, and sync-recovery edge cases', () => {
    const duplicates = createOperationalScenario('duplicate-strategies', 'duplicates');
    expect(duplicates.addresses[1]).toEqual(expect.objectContaining({
      addressLine1: duplicates.addresses[0].addressLine1,
      zip: duplicates.addresses[0].zip
    }));

    const encoding = createOperationalScenario('encoding-edge-cases', 'encoding');
    expect(encoding.addresses[0]).toEqual(expect.objectContaining({ zip: '00123', unit: 'Mock Unit 01' }));
    expect(encoding.visits[1].notes).toContain('\n');

    const sync = createOperationalScenario('sync-recovery', 'sync');
    expect(sync.visits.map((visit) => visit.syncStatus)).toEqual(
      expect.arrayContaining(['pending', 'failed', 'conflict'])
    );
    expect(sync.visits.some((visit) => visit.notes?.includes('correction'))).toBe(true);
  });
});
