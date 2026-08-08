import { FlatList, Share, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, spacing, typography } from '../theme';
import { formatLocalDateTime } from '../utils/datetime';
import { buildRedactedSyncDiagnosticExport, queueAgeMinutes } from '../syncDiagnostics';

export function QueueScreen() {
  const { queue, syncQueue, isSyncing, isOnline } = useApp();

  async function shareDiagnostics() {
    await Share.share({
      title: 'PROACTIVE redacted sync diagnostics',
      message: buildRedactedSyncDiagnosticExport(queue)
    });
  }

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.content}
        data={queue}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <Card style={styles.header}>
            <Text style={styles.title}>Sync Queue</Text>
            <Text style={styles.copy}>
              {isOnline
                ? 'Queued visits will sync automatically, or you can force a retry now.'
                : 'The device is offline. Pending visits are stored locally until connectivity returns.'}
            </Text>
            <View style={styles.headerRow}>
              <Pill label={`${queue.length} pending`} tone={queue.length > 0 ? 'gold' : 'default'} />
              <Pill label={isOnline ? 'Online' : 'Offline'} tone={isOnline ? 'success' : 'warning'} />
            </View>
            <Button label="Sync Now" onPress={() => void syncQueue()} loading={isSyncing} />
            <Button label="Share Redacted Diagnostics" variant="secondary" onPress={() => void shareDiagnostics()} />
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <View style={styles.rowTop}>
              <Pill label={formatSyncStatus(item.syncStatus)} tone={syncTone(item.syncStatus)} />
              <Pill label={formatGpsStatus(item.payload.gpsStatus)} tone={gpsTone(item.payload.gpsStatus)} />
            </View>
            <Text style={styles.address}>{item.addressMeta.addressLine1}</Text>
            <Text style={styles.meta}>
              {item.addressMeta.city}, {item.addressMeta.state}
              {item.addressMeta.zip ? ` ${item.addressMeta.zip}` : ''}
            </Text>
            <Text style={styles.meta}>Result: {formatResult(item.payload.outcomeCode)}</Text>
            <Text style={styles.meta}>
              Saved: {formatLocalDateTime(item.createdAt)}
            </Text>
            <Text style={styles.meta}>Queue age: {formatQueueAge(queueAgeMinutes(item))}</Text>
            <Text style={styles.meta}>Retries: {item.diagnostics.retryCount}</Text>
            <Text style={styles.meta}>
              Dependency: {formatResult(item.diagnostics.dependencyState)} · Server acknowledgement: {item.diagnostics.serverAcknowledged ? 'Yes' : 'No'}
            </Text>
            {item.diagnostics.lastErrorCategory ? (
              <Text style={styles.meta}>Last error category: {formatResult(item.diagnostics.lastErrorCategory)}</Text>
            ) : null}
            <Text style={styles.meta}>
              Client time: {formatLocalDateTime(item.payload.clientCreatedAt)}
            </Text>
            <Text style={styles.meta}>
              GPS accuracy: {formatAccuracy(item.payload.accuracyMeters)}
            </Text>
            {item.syncConflictReason ? (
              <Text style={styles.meta}>Conflict reason: {formatResult(item.syncConflictReason)}</Text>
            ) : null}
          </Card>
        )}
        ListEmptyComponent={
          <Card style={styles.empty}>
            <Text style={styles.title}>Queue is empty</Text>
            <Text style={styles.copy}>No unsent visits are waiting to sync.</Text>
          </Card>
        }
      />
    </Screen>
  );
}

function formatQueueAge(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ${minutes % 60} min`;
}

function formatResult(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSyncStatus(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatGpsStatus(value: string) {
  return `GPS ${formatSyncStatus(value)}`;
}

function formatAccuracy(value?: number | null) {
  if (value === null || value === undefined) {
    return 'Unavailable';
  }
  return `${Math.round(value)} m`;
}

function syncTone(value: string) {
  if (value === 'synced') {
    return 'success';
  }
  if (value === 'failed' || value === 'conflict') {
    return 'warning';
  }
  return 'gold';
}

function gpsTone(value: string) {
  if (value === 'verified') {
    return 'success';
  }
  if (value === 'missing' || value === 'low_accuracy') {
    return 'warning';
  }
  return 'gold';
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    lineHeight: 21,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  itemCard: {
    gap: 6,
  },
  address: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  meta: {
    color: colors.muted,
    fontSize: typography.body,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
  },
});
