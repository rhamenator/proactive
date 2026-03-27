import { FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Pill } from '../components/Pill';
import { Screen } from '../components/Screen';
import { useApp } from '../context/AppContext';
import { colors, spacing, typography } from '../theme';

export function QueueScreen() {
  const { queue, syncQueue, isSyncing, isOnline } = useApp();

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
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <Text style={styles.address}>{item.addressMeta.addressLine1}</Text>
            <Text style={styles.meta}>
              {item.addressMeta.city}, {item.addressMeta.state}
              {item.addressMeta.zip ? ` ${item.addressMeta.zip}` : ''}
            </Text>
            <Text style={styles.meta}>Result: {formatResult(item.payload.result)}</Text>
            <Text style={styles.meta}>Saved: {new Date(item.createdAt).toLocaleString()}</Text>
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

function formatResult(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
