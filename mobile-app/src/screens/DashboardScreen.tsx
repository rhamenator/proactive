import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing, typography } from '../theme';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const {
    user,
    turf,
    session,
    progress,
    queue,
    isOnline,
    isSyncing,
    statusMessage,
    errorMessage,
    refreshTurf,
    startTurf,
    pauseTurf,
    resumeTurf,
    completeTurf,
    syncQueue,
  } = useApp();

  const sessionStatus =
    session?.status ?? (session?.endTime ? 'completed' : session ? 'active' : 'idle');
  const canResume = sessionStatus === 'paused';
  const canPause = sessionStatus === 'active';
  const canComplete = sessionStatus === 'active' || sessionStatus === 'paused';
  const canStart = sessionStatus === 'idle' || sessionStatus === 'completed';

  async function handleStart() {
    try {
      await startTurf();
    } catch (error) {
      Alert.alert('Unable to start turf', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleEnd() {
    const remainingAddresses = Math.max(progress.total - progress.completed, 0);
    if (remainingAddresses > 0) {
      Alert.alert(
        'Complete turf with unattempted addresses?',
        `${remainingAddresses} address${remainingAddresses === 1 ? '' : 'es'} still have no logged attempt. You can still complete the turf, but make sure this is intentional.`,
        [
          { text: 'Keep Working', style: 'cancel' },
          {
            text: 'Complete Turf',
            style: 'destructive',
            onPress: () => {
              void completeTurf().catch((error) => {
                Alert.alert('Unable to complete turf', error instanceof Error ? error.message : 'Please try again.');
              });
            },
          },
        ]
      );
      return;
    }

    try {
      await completeTurf();
    } catch (error) {
      Alert.alert('Unable to complete turf', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handlePause() {
    try {
      await pauseTurf();
    } catch (error) {
      Alert.alert('Unable to pause turf', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleResume() {
    try {
      await resumeTurf();
    } catch (error) {
      Alert.alert('Unable to resume turf', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleRefresh() {
    try {
      await refreshTurf();
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : 'Unable to load turf snapshot.');
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Hello, {user?.firstName || 'Canvasser'}.</Text>
          <Text style={styles.heroCopy}>
            Keep the buttons large, keep the taps simple, and keep the log moving.
          </Text>
          <View style={styles.row}>
            <Pill label={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'success' : 'warning'} />
            <Pill label={`${queue.length} queued`} tone={queue.length > 0 ? 'gold' : 'default'} />
            <Pill
              label={
                sessionStatus === 'paused'
                  ? 'Paused'
                  : sessionStatus === 'active'
                    ? 'Active session'
                    : sessionStatus === 'completed'
                      ? 'Closed'
                      : 'Idle'
              }
            />
          </View>
        </View>

        <Card style={styles.turfCard}>
          <Text style={styles.sectionLabel}>My Turf</Text>
          <Text style={styles.turfName}>{turf?.name || 'No turf assigned'}</Text>
          <Text style={styles.turfCopy}>
            {turf?.description || 'Once a turf is assigned, start the session to begin logging visits.'}
          </Text>

          <View style={styles.row}>
            <Pill
              label={
                sessionStatus === 'paused'
                  ? 'Paused'
                  : sessionStatus === 'active'
                    ? 'Active session'
                    : sessionStatus === 'completed'
                      ? 'Completed'
                      : 'Idle'
              }
              tone={sessionStatus === 'paused' ? 'warning' : sessionStatus === 'active' ? 'success' : 'default'}
            />
            <Pill label={session?.endTime ? 'Closed' : 'Open'} tone={session?.endTime ? 'default' : 'gold'} />
          </View>

          <View style={styles.statsRow}>
            <Stat label="Completed" value={`${progress.completed}/${progress.total || 0}`} />
            <Stat label="Pending sync" value={`${progress.pendingSync}`} />
            <Stat label="Queued" value={`${queue.length}`} />
          </View>

          <View style={styles.actionColumn}>
            {canStart ? <Button label="Start Turf" onPress={() => void handleStart()} /> : null}
            {canPause ? <Button label="Pause Turf" onPress={() => void handlePause()} variant="secondary" /> : null}
            {canResume ? <Button label="Resume Turf" onPress={() => void handleResume()} /> : null}
            {canComplete ? <Button label="Complete Turf" onPress={() => void handleEnd()} variant="result" /> : null}
            <Button label="Refresh Turf" onPress={() => void handleRefresh()} variant="ghost" />
          </View>
        </Card>

        <Card style={styles.quickCard}>
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.actionColumn}>
            <Button
              label="Open Address List"
              onPress={() => navigation.navigate('AddressList')}
            />
            <Button
              label="Request Missing Address"
              onPress={() => navigation.navigate('AddressRequest')}
              variant="secondary"
            />
            <Button
              label="Session Notes"
              onPress={() => navigation.navigate('SessionNotes')}
              variant="secondary"
            />
            <Button
              label="My Performance"
              onPress={() => navigation.navigate('Performance')}
              variant="ghost"
            />
            <Button label="Sync Queue" onPress={() => void syncQueue()} variant="secondary" loading={isSyncing} />
            <Button label="Review Queue" onPress={() => navigation.navigate('Queue')} variant="ghost" />
          </View>
        </Card>

        {(statusMessage || errorMessage) && (
          <Card style={styles.notice}>
            <Text style={styles.noticeLabel}>Status</Text>
            <Text style={styles.noticeText}>{statusMessage || errorMessage}</Text>
          </Card>
        )}

        <Card style={styles.tipCard}>
          <Text style={styles.sectionLabel}>Field Notes</Text>
          <Text style={styles.tipText}>
            Use Session Notes to track houses, extra addresses, or reminders during an active session without breaking
            the visit flow.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
  },
  heroCopy: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: typography.body,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  turfCard: {
    gap: spacing.md,
  },
  sectionLabel: {
    color: colors.blue,
    fontSize: typography.small,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  turfName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  turfCopy: {
    color: colors.muted,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.muted,
    fontSize: typography.small,
    marginTop: 4,
  },
  actionColumn: {
    gap: spacing.sm,
  },
  quickCard: {
    gap: spacing.md,
  },
  notice: {
    gap: spacing.xs,
  },
  noticeLabel: {
    color: colors.blue,
    fontWeight: '800',
  },
  noticeText: {
    color: colors.text,
  },
  tipCard: {
    gap: spacing.xs,
    backgroundColor: colors.goldSoft,
  },
  tipText: {
    color: colors.text,
    lineHeight: 21,
  },
});
