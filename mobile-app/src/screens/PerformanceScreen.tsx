import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { api } from '../api/client';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, spacing, typography } from '../theme';
import type { SelfPerformanceReport } from '../types';

export function PerformanceScreen() {
  const { token, errorMessage } = useApp();
  const [report, setReport] = useState<SelfPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing session token.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      setReport(await api.myPerformance(token));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to load performance report.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.title}>My Performance</Text>
          <Text style={styles.copy}>
            This report is view-only and reflects your synced field activity. Time-based trend buckets are reported in{' '}
            {report?.trends.bucketTimeZone ?? 'UTC'}.
          </Text>
        </Card>

        {loading ? (
          <Card style={styles.card}>
            <Text style={styles.copy}>Loading performance report…</Text>
          </Card>
        ) : null}

        {error || errorMessage ? (
          <Card style={styles.card}>
            <Text style={styles.error}>{error || errorMessage}</Text>
          </Card>
        ) : null}

        {report ? (
          <>
            <Card style={styles.card}>
              <Text style={styles.section}>Core Totals</Text>
              <View style={styles.statsRow}>
                <Stat label="Visits" value={report.overview.kpis.totalVisits} />
                <Stat label="Contacts" value={report.overview.kpis.contactsMade} />
                <Stat label="Final" value={report.overview.kpis.outcomes.finalDisposition} />
              </View>
              <View style={styles.statsRow}>
                <Stat label="Revisits" value={report.overview.kpis.revisitVisits} />
                <Stat label="GPS Flagged" value={report.overview.kpis.gpsStatus.flagged} />
                <Stat label="Conflicts" value={report.overview.dataFreshness.conflictRecords} />
              </View>
            </Card>

            {report.productivity ? (
              <Card style={styles.card}>
                <Text style={styles.section}>Productivity</Text>
                <Text style={styles.copy}>Unique addresses: {report.productivity.uniqueAddressesVisited}</Text>
                <Text style={styles.copy}>Sessions: {report.productivity.sessionsCount}</Text>
                <Text style={styles.copy}>Average session: {report.productivity.averageSessionMinutes.toFixed(1)} minutes</Text>
                <Text style={styles.copy}>Houses per hour: {report.productivity.housesPerHour.toFixed(2)}</Text>
              </Card>
            ) : null}

            <Card style={styles.card}>
              <Text style={styles.section}>Recent Daily Trend</Text>
              {report.trends.byDay.slice(0, 7).map((entry) => (
                <View key={entry.day} style={styles.trendRow}>
                  <Text style={styles.trendLabel}>{entry.day}</Text>
                  <Text style={styles.trendValue}>
                    {entry.visits} visits / {entry.contactsMade} contacts
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md
  },
  card: {
    gap: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900'
  },
  section: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  copy: {
    color: colors.muted,
    lineHeight: 21
  },
  error: {
    color: colors.red,
    fontWeight: '700'
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  stat: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: 12,
    padding: spacing.md
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900'
  },
  statLabel: {
    color: colors.muted,
    marginTop: 4
  },
  trendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md
  },
  trendLabel: {
    color: colors.text,
    fontWeight: '700'
  },
  trendValue: {
    color: colors.muted
  }
});
